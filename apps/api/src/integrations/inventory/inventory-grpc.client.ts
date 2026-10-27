import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'node:path';
import type {
  StockUpdateAck,
  StockUpdateMessage,
} from './inventory-stock.types';

type InventoryClient = grpc.Client & {
  PushStockUpdate(
    message: StockUpdateMessage,
    deadline: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, ack?: StockUpdateAck) => void,
  ): grpc.ClientUnaryCall;
};
type InventoryConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
) => InventoryClient;

@Injectable()
export class InventoryGrpcClient implements OnApplicationShutdown {
  private readonly logger = new Logger(InventoryGrpcClient.name);
  private client?: InventoryClient;

  isEnabled(): boolean {
    return (
      process.env.STOCK_SYNC_ENABLED === 'true' &&
      Boolean(process.env.BOOKING_GRPC_ADDR)
    );
  }

  async push(message: StockUpdateMessage): Promise<StockUpdateAck> {
    if (!this.isEnabled()) throw new Error('STOCK_SYNC_DISABLED');
    const client = this.getClient();
    return new Promise((resolve, reject) => {
      client.PushStockUpdate(
        message,
        { deadline: Date.now() + 5000 },
        (error, ack) =>
          error
            ? reject(error)
            : ack
              ? resolve(ack)
              : reject(new Error('EMPTY_GRPC_ACK')),
      );
    });
  }

  onApplicationShutdown(): void {
    this.client?.close();
  }

  private getClient(): InventoryClient {
    if (this.client) return this.client;
    const address = process.env.BOOKING_GRPC_ADDR;
    if (!address) throw new Error('BOOKING_GRPC_ADDR is required');
    const definition = protoLoader.loadSync(
      join(__dirname, '../../proto/inventory.proto'),
      {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );
    const loaded = grpc.loadPackageDefinition(definition) as unknown as {
      inventory: { InventoryStockService: InventoryConstructor };
    };
    const credentials =
      process.env.BOOKING_GRPC_TLS === 'true'
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();
    this.client = new loaded.inventory.InventoryStockService(
      address,
      credentials,
    );
    this.logger.log(
      `Inventory gRPC client ready for ${address} (TLS=${process.env.BOOKING_GRPC_TLS === 'true'})`,
    );
    return this.client;
  }
}
