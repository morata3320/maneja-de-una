import { Module } from '@nestjs/common';
import { AutosController } from './autos.controller';
import { AutosGuard } from './contract/autos.guard';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { WebhooksService } from './webhooks.service';
import {
  PaymentReferenceVerifier,
  LocalPaymentReferenceVerifier,
} from './payment-reference';
import { VehiclesModule } from '../../vehicles/vehicles.module';
@Module({
  imports: [VehiclesModule],
  controllers: [AutosController],
  providers: [
    AutosGuard,
    CatalogService,
    OrdersService,
    WebhooksService,
    {
      provide: PaymentReferenceVerifier,
      useClass: LocalPaymentReferenceVerifier,
    },
  ],
  exports: [WebhooksService],
})
export class AutosModule {}
