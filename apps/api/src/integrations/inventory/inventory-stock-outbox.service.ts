import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';

@Injectable()
export class InventoryStockOutboxService {
  async enqueue(
    manager: EntityManager,
    vehicleId: string,
    instant: Date,
    availableUnits: 0 | 1,
    correlationId?: string,
  ): Promise<void> {
    const serviceId = process.env.AUTOS_NODE_ID ?? 'maneja-de-una';
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Guayaquil',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(instant);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );
    const roundedMinute = minute < 30 ? '00' : '30';
    const timeSlot = `${String(hour).padStart(2, '0')}:${roundedMinute}`;
    const slotId = `slot-${date.replaceAll('-', '')}-${timeSlot.replace(':', '')}`;
    const now = Date.now();
    const [clock] = await manager.query<Array<{ last_timestamp: string }>>(
      `
      INSERT INTO inventory_stock_monotonic(service_id,item_id,date,time_slot,last_timestamp)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(service_id,item_id,date,time_slot) DO UPDATE
      SET last_timestamp=GREATEST(inventory_stock_monotonic.last_timestamp + 1,$5)
      RETURNING last_timestamp
    `,
      [serviceId, vehicleId, date, timeSlot, now],
    );
    await manager.query(
      `
      INSERT INTO inventory_stock_outbox(
        id,vehicle_id,service_id,item_id,date,time_slot,slot_id,
        available_units,event_timestamp,correlation_id
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        randomUUID(),
        vehicleId,
        serviceId,
        vehicleId,
        date,
        timeSlot,
        slotId,
        availableUnits,
        Number(clock.last_timestamp),
        correlationId ?? null,
      ],
    );
  }
}
