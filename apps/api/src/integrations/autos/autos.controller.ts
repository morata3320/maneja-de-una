import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AutosGuard, AutosOperation } from './contract/autos.guard';
import type { AutosRequest } from './contract/autos.guard';
import type {
  CarSearchRequest,
  CarSearchResponse,
  DepotsRequest,
  DepotsResponse,
  DepotScoresRequest,
  DepotScoresResponse,
  CarDetailsRequest,
  CarDetailsResponse,
  SuppliersRequest,
  SuppliersResponse,
  CarConstantsRequest,
  CarConstantsResponse,
  OrderHoldRequest,
  OrderHoldResponse,
  OrderPreviewRequest,
  OrderPreviewResponse,
  OrderCreateRequest,
  OrderDetail,
  OrderModifyRequest,
  WebhookSubscription,
} from './contract/autos.types';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { WebhooksService } from './webhooks.service';
@ApiExcludeController()
@Controller('autos/v1')
@UseGuards(AutosGuard)
export class AutosController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Post('search')
  @HttpCode(200)
  @AutosOperation('/search')
  async search(
    @Body() body: CarSearchRequest,
    @Req() req: AutosRequest,
  ): Promise<CarSearchResponse> {
    return this.catalog.search(body, req.affiliate!);
  }

  @Post('depots')
  @HttpCode(200)
  @AutosOperation('/depots')
  async depots(
    @Body() body: DepotsRequest,
    @Req() req: AutosRequest,
  ): Promise<DepotsResponse> {
    return this.catalog.depots(body ?? {}, req.affiliate!);
  }

  @Post('depots/reviews/scores')
  @HttpCode(200)
  @AutosOperation('/depots/reviews/scores')
  async scores(
    @Body() body: DepotScoresRequest,
    @Req() req: AutosRequest,
  ): Promise<DepotScoresResponse> {
    return this.catalog.scores(body, req.affiliate!);
  }

  @Post('details')
  @HttpCode(200)
  @AutosOperation('/details')
  async details(
    @Body() body: CarDetailsRequest,
    @Req() req: AutosRequest,
  ): Promise<CarDetailsResponse> {
    return this.catalog.details(body, req.affiliate!);
  }

  @Post('suppliers')
  @HttpCode(200)
  @AutosOperation('/suppliers')
  async suppliers(
    @Body() body: SuppliersRequest,
    @Req() req: AutosRequest,
  ): Promise<SuppliersResponse> {
    return this.catalog.suppliers(body ?? {}, req.affiliate!);
  }

  @Post('constants')
  @HttpCode(200)
  @AutosOperation('/constants')
  async constants(
    @Body() body: CarConstantsRequest,
  ): Promise<CarConstantsResponse> {
    return this.catalog.constants(body ?? {});
  }

  @Post('orders/hold')
  @HttpCode(200)
  @AutosOperation('/orders/hold')
  async hold(
    @Body() body: OrderHoldRequest,
    @Req() req: AutosRequest,
  ): Promise<OrderHoldResponse> {
    return this.orders.hold(body, req.principal!.sub);
  }

  @Post('orders/preview')
  @HttpCode(200)
  @AutosOperation('/orders/preview')
  async preview(
    @Body() body: OrderPreviewRequest,
    @Req() req: AutosRequest,
  ): Promise<OrderPreviewResponse> {
    return this.orders.preview(body, req.principal!.sub);
  }

  @Post('orders/create')
  @HttpCode(201)
  @AutosOperation('/orders/create')
  async create(
    @Body() body: OrderCreateRequest,
    @Req() req: AutosRequest,
  ): Promise<OrderDetail> {
    return this.orders.create(
      body,
      req.principal!.sub,
      String(req.headers['idempotency-key']),
    );
  }

  @Post('orders/:orderId/modify')
  @HttpCode(200)
  @AutosOperation('/orders/{orderId}/modify')
  async modify(
    @Body() body: OrderModifyRequest,
    @Req() req: AutosRequest,
  ): Promise<OrderDetail> {
    return this.orders.modify(
      String(req.params.orderId),
      body,
      req.principal!.sub,
      String(req.headers['idempotency-key']),
    );
  }

  @Post('webhooks')
  @HttpCode(201)
  @AutosOperation('/webhooks')
  async subscribe(
    @Body() body: WebhookSubscription,
    @Req() req: AutosRequest,
  ): Promise<WebhookSubscription> {
    return this.webhooks.create(body, req.principal!.sub);
  }

  @Get('orders/:orderId')
  @AutosOperation('/orders/{orderId}', 'get')
  get(@Req() req: AutosRequest): Promise<OrderDetail> {
    return this.orders.get(String(req.params.orderId), req.principal!.sub);
  }
  @Post('orders/:orderId/cancel')
  @HttpCode(200)
  @AutosOperation('/orders/{orderId}/cancel')
  async cancel(@Req() req: AutosRequest): Promise<void> {
    await this.orders.cancel(
      String(req.params.orderId),
      req.principal!.sub,
      String(req.headers['idempotency-key']),
    );
  }
  @Get('webhooks')
  @AutosOperation('/webhooks', 'get')
  list(@Req() req: AutosRequest): Promise<WebhookSubscription[]> {
    return this.webhooks.list(req.principal!.sub);
  }
  @Delete('webhooks/:id')
  @HttpCode(204)
  @AutosOperation('/webhooks/{id}', 'delete')
  async remove(@Req() req: AutosRequest): Promise<void> {
    await this.webhooks.remove(String(req.params.id), req.principal!.sub);
  }
}
