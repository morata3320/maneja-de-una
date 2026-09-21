import { Module } from '@nestjs/common';
import { VehicleAvailabilityService } from './domain/vehicle-availability.service';

@Module({
  providers: [VehicleAvailabilityService],
  exports: [VehicleAvailabilityService],
})
export class VehiclesModule {}
