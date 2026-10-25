import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CorrelatedRequest } from '../../common/types/request-context';
import {
  CancelOrderV2Dto,
  CreateAutoOrderV2Dto,
  DeliveryCheckinV2Dto,
  DigitalCheckinV2Dto,
  MaintenanceV2Dto,
  PromotionAgreementV2Dto,
  ReturnCheckinV2Dto,
  SearchAutosV2Dto,
} from './autos-v2.dto';
import {
  AutosV2Guard,
  AutosV2Scopes,
  type AutosV2Request,
} from './autos-v2.guard';
import { AutosV2Service } from './autos-v2.service';

@ApiTags('Autos RDA2 v2')
@Controller('api/v2/autos')
export class AutosV2Controller {
  constructor(private readonly service: AutosV2Service) {}

  @Get('health')
  @ApiOperation({ summary: 'Salud y telemetría del nodo de autos' })
  health() {
    return this.service.health();
  }

  @Get('promociones/contrato')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  promotion() {
    return this.service.promotion();
  }

  @Put('promociones/contrato')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:admin')
  @ApiBearerAuth()
  updatePromotion(
    @Body() body: PromotionAgreementV2Dto,
    @Req() req: AutosV2Request,
  ) {
    return this.service.updatePromotion(body, req.actor);
  }

  @Get('eventos')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  events(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('after') after?: string,
  ) {
    return this.service.events(limit, after);
  }

  @Get()
  catalog(
    @Query('category') category?: string,
    @Query('transmission') transmission?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.catalog(category, transmission, limit);
  }

  @Post('search')
  @HttpCode(200)
  search(@Body() body: SearchAutosV2Dto) {
    return this.service.search(body);
  }

  @Get('flota')
  fleet() {
    return this.service.fleet();
  }

  @Get('orders')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  orders(@Req() req: AutosV2Request) {
    return this.service.orders(req.actor);
  }

  @Post('orders/create')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Body() body: CreateAutoOrderV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.createOrder(body, req.actor, key, String(req.correlationId));
  }

  @Post('reservas')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reserve(
    @Body() body: CreateAutoOrderV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.createOrder(body, req.actor, key, String(req.correlationId));
  }

  @Post('reservas/:id/checkin')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  digitalCheckin(
    @Param('id') id: string,
    @Body() _body: DigitalCheckinV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.digitalCheckin(id, req.actor, String(req.correlationId));
  }

  @Post('orders/:id/checkin-entrega')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  delivery(
    @Param('id') id: string,
    @Body() body: DeliveryCheckinV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.delivery(id, body, req.actor, String(req.correlationId));
  }

  @Post('orders/:id/checkin-devolucion')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  returnOrder(
    @Param('id') id: string,
    @Body() body: ReturnCheckinV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.returnOrder(id, body, req.actor, String(req.correlationId));
  }

  @Get('orders/:orderId')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  order(@Param('orderId') id: string, @Req() req: AutosV2Request) {
    return this.service.order(id, req.actor);
  }

  @Post('orders/:orderId/cancel')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:cancel')
  @ApiBearerAuth()
  cancel(
    @Param('orderId') id: string,
    @Body() _body: CancelOrderV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.cancel(id, req.actor, String(req.correlationId));
  }

  @Get(':id/coberturas')
  coverages(@Param('id') id: string) {
    return this.service.coverages(id);
  }

  @Get(':id')
  vehicle(@Param('id') id: string) {
    return this.service.vehicle(id);
  }

  @Post(':id/devolucion')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  returnByVehicle(
    @Param('id') id: string,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.returnByVehicle(id, req.actor, String(req.correlationId));
  }

  @Post(':id/mantenimiento/registro')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:maintenance')
  @ApiBearerAuth()
  maintenance(
    @Param('id') id: string,
    @Body() body: MaintenanceV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.service.maintenance(id, body, req.actor, String(req.correlationId));
  }
}
