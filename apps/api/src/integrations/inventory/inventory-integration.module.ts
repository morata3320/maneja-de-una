import { Module } from '@nestjs/common';
import { InventoryGrpcClient } from './inventory-grpc.client';
import { InventoryStockOutboxService } from './inventory-stock-outbox.service';
import { InventoryStockRelayService } from './inventory-stock-relay.service';

@Module({
  providers: [
    InventoryGrpcClient,
    InventoryStockOutboxService,
    InventoryStockRelayService,
  ],
  exports: [InventoryStockOutboxService, InventoryStockRelayService],
})
export class InventoryIntegrationModule {}
