import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

class HealthResponse {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: string;
  @ApiProperty({ example: 'maneja-de-una-api' })
  service: string;
  @ApiProperty({ format: 'date-time' })
  timestamp: string;
}
@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Disponibilidad de la API, sin comprobar base de datos',
  })
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'maneja-de-una-api',
      timestamp: new Date().toISOString(),
    };
  }
}
