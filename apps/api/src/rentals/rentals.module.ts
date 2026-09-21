import { Module } from '@nestjs/common';
import { RentalPeriodService } from './domain/rental-period.service';
import { RentalPricingService } from './domain/rental-pricing.service';

@Module({
  providers: [RentalPeriodService, RentalPricingService],
  exports: [RentalPeriodService, RentalPricingService],
})
export class RentalsModule {}
