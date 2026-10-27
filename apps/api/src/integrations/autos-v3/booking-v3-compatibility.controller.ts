import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AutosV3Service } from './autos-v3.service';

/**
 * Compatibility endpoint used by the Booking dashboard, which probes
 * `${baseUrlRest}/health` while the official contract remains under
 * `/api/v3/autos`.
 */
@ApiExcludeController()
@Controller('api/v3')
export class BookingV3CompatibilityController {
  constructor(private readonly autos: AutosV3Service) {}

  @Get('health')
  health() {
    return this.autos.health();
  }
}
