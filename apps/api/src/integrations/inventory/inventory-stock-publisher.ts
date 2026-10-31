import { Injectable } from '@nestjs/common';
import { InventoryGrpcClient } from './inventory-grpc.client';
import { InventoryRestClient } from './inventory-rest.client';
import { InventoryRabbitMqClient } from './inventory-rabbitmq.client';
import type {
  StockUpdateAck,
  StockUpdateMessage,
} from './inventory-stock.types';

@Injectable()
export class InventoryStockPublisher {
  constructor(
    private readonly grpc: InventoryGrpcClient,
    private readonly rest: InventoryRestClient,
    private readonly rabbitmq: InventoryRabbitMqClient,
  ) {}

  isEnabled(): boolean {
    return this.transport().isEnabled();
  }

  push(message: StockUpdateMessage): Promise<StockUpdateAck> {
    return this.transport().push(message);
  }

  private transport():
    InventoryGrpcClient | InventoryRestClient | InventoryRabbitMqClient {
    if (process.env.STOCK_SYNC_TRANSPORT === 'rest') return this.rest;
    if (process.env.STOCK_SYNC_TRANSPORT === 'rabbitmq') return this.rabbitmq;
    return this.grpc;
  }
}
