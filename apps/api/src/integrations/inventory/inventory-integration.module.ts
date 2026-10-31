import { Module } from '@nestjs/common';
import { InventoryGrpcClient } from './inventory-grpc.client';
import { InventoryRestClient } from './inventory-rest.client';
import { InventoryRabbitMqClient } from './inventory-rabbitmq.client';
import { InventoryStockOutboxService } from './inventory-stock-outbox.service';
import { InventoryStockPublisher } from './inventory-stock-publisher';
import { InventoryStockRelayService } from './inventory-stock-relay.service';

@Module({
  providers: [
    InventoryGrpcClient,
    InventoryRestClient,
    InventoryRabbitMqClient,
    InventoryStockPublisher,
    InventoryStockOutboxService,
    InventoryStockRelayService,
  ],
  exports: [InventoryStockOutboxService, InventoryStockRelayService],
})
export class InventoryIntegrationModule {}
