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
  DeliveryCheckinV2Dto,
  DigitalCheckinV2Dto,
  MaintenanceV2Dto,
  PromotionAgreementV2Dto,
  ReturnCheckinV2Dto,
  SearchAutosV2Dto,
} from '../autos-v2/autos-v2.dto';
import {
  AutosV2Guard,
  AutosV2Scopes,
  type AutosV2Request,
} from '../autos-v2/autos-v2.guard';
import { AutosV2Service } from '../autos-v2/autos-v2.service';
import { CreateAutoOrderV3Dto } from './autos-v3.dto';
import { AutosV3Service } from './autos-v3.service';

@ApiTags('Autos RDA2 v3')
@Controller('api/v3/autos')
export class AutosV3Controller {
  constructor(
    private readonly v3: AutosV3Service,
    private readonly autos: AutosV2Service,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Salud del nodo de Autos V3' })
  health() {
    return this.v3.health();
  }
  @Get() catalog(
    @Query('category') category?: string,
    @Query('transmission') transmission?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.v3.catalog(category, transmission, limit);
  }
  @Post('search') @HttpCode(200) search(@Body() body: SearchAutosV2Dto) {
    return this.autos.search(body);
  }
  @Get('flota') fleet() {
    return this.autos.fleet();
  }

  @Get('promociones/contrato')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  promotion() {
    return this.autos.promotion();
  }
  @Put('promociones/contrato')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:admin')
  @ApiBearerAuth()
  updatePromotion(
    @Body() body: PromotionAgreementV2Dto,
    @Req() req: AutosV2Request,
  ) {
    return this.autos.updatePromotion(body, req.actor);
  }
  @Get('eventos')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  events(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('after') after?: string,
  ) {
    return this.autos.events(limit, after);
  }

  @Get('orders')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  orders(@Req() req: AutosV2Request) {
    return this.v3.orders(req.actor);
  }
  @Post('orders/create')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Body() body: CreateAutoOrderV3Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.v3.create(body, req.actor, key, String(req.correlationId));
  }
  @Post('reservas')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reserve(
    @Body() body: CreateAutoOrderV3Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.v3.create(body, req.actor, key, String(req.correlationId));
  }
  @Get('orders/:orderId')
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:read')
  @ApiBearerAuth()
  order(@Param('orderId') id: string, @Req() req: AutosV2Request) {
    return this.v3.order(id, req.actor);
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
    return this.v3.cancel(id, req.actor, String(req.correlationId));
  }

  @Post('reservas/:id/checkin')
  @HttpCode(200)
  @UseGuards(AutosV2Guard)
  @AutosV2Scopes('autos:book')
  @ApiBearerAuth()
  digital(
    @Param('id') id: string,
    @Body() _body: DigitalCheckinV2Dto,
    @Req() req: AutosV2Request & CorrelatedRequest,
  ) {
    return this.autos.digitalCheckin(id, req.actor, String(req.correlationId));
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
    return this.autos.delivery(id, body, req.actor, String(req.correlationId));
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
    return this.autos.returnOrder(
      id,
      body,
      req.actor,
      String(req.correlationId),
    );
  }

  @Get(':id/coberturas') coverages(@Param('id') id: string) {
    return this.autos.coverages(id);
  }
  @Get(':id') vehicle(@Param('id') id: string) {
    return this.autos.vehicle(id);
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
    return this.autos.returnByVehicle(id, req.actor, String(req.correlationId));
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
    return this.autos.maintenance(
      id,
      body,
      req.actor,
      String(req.correlationId),
    );
  }
}
