import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryGrpcClient } from './inventory-grpc.client';
import type { PendingStockUpdate } from './inventory-stock.types';

@Injectable()
export class InventoryStockRelayService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(InventoryStockRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly db: DataSource,
    private readonly grpc: InventoryGrpcClient,
  ) {}

  onModuleInit(): void {
    if (!this.grpc.isEnabled()) {
      this.logger.log(
        'Stock relay disabled; pending Outbox rows are preserved.',
      );
      return;
    }
    const interval = Math.max(
      1000,
      Number(process.env.STOCK_SYNC_INTERVAL_MS ?? 5000),
    );
    this.timer = setInterval(() => void this.flush(), interval);
    this.timer.unref();
    void this.flush();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async flush(): Promise<void> {
    if (this.running || !this.grpc.isEnabled()) return;
    this.running = true;
    try {
      await this.db.transaction(async (manager) => {
        const rows = await manager.query<PendingStockUpdate[]>(`
          SELECT id,service_id,item_id,date::text,time_slot,available_units,
                 event_timestamp::float8 AS timestamp,slot_id,attempts
          FROM inventory_stock_outbox
          WHERE acknowledged_at IS NULL AND next_attempt_at<=now()
          ORDER BY next_attempt_at,id
          LIMIT 20 FOR UPDATE SKIP LOCKED
        `);
        for (const row of rows) {
          try {
            const ack = await this.grpc.push(row);
            if (!ack.success || (ack.error_code && ack.error_code !== 'OK'))
              throw new Error(
                `ACK_${ack.error_code || 'REJECTED'}: ${ack.message}`,
              );
            await manager.query(
              `
              UPDATE inventory_stock_outbox SET acknowledged_at=now(),ack_payload=$2,
                last_error=NULL,updated_at=now() WHERE id=$1
            `,
              [row.id, ack],
            );
          } catch (error) {
            const attempts = row.attempts + 1;
            const delaySeconds = Math.min(300, 2 ** Math.min(attempts, 8));
            await manager.query(
              `
              UPDATE inventory_stock_outbox SET attempts=$2,
                next_attempt_at=now()+($3 * interval '1 second'),last_error=$4,updated_at=now()
              WHERE id=$1
            `,
              [
                row.id,
                attempts,
                delaySeconds,
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : 'Unknown gRPC error',
              ],
            );
          }
        }
      });
    } finally {
      this.running = false;
    }
  }
}
