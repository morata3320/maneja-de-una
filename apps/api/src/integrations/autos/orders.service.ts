import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import type {
  OrderHoldRequest,
  OrderHoldResponse,
  OrderPreviewRequest,
  OrderPreviewResponse,
  OrderCreateRequest,
  OrderModifyRequest,
  OrderDetail,
  Route,
} from './contract/autos.types';
import type {
  SearchRow,
  HoldRow,
  PreviewRow,
  OrderRow,
  VehicleRow,
} from '../../persistence/rows';
import { AutosError } from './autos-error';
import { period, price, fingerprint, ttl } from './autos-policy';
import { CatalogService } from './catalog.service';
import { PaymentReferenceVerifier } from './payment-reference';
import { VehicleAvailabilityService } from '../../vehicles/domain/vehicle-availability.service';
import { VehicleStatus } from '../../vehicles/domain/vehicle.enums';
export const emitEvent = async (
  m: EntityManager,
  owner: string | null,
  type: string,
  resource: string,
  data: object,
): Promise<void> => {
  await m.query(
    'INSERT INTO webhook_outbox(id,owner_id,event_type,resource_id,data) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), owner, type, resource, data],
  );
};
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DataSource,
    private readonly catalog: CatalogService,
    private readonly payment: PaymentReferenceVerifier,
    private readonly availability: VehicleAvailabilityService,
  ) {}
  private async context(
    m: EntityManager,
    id: string,
    vehicle: string,
  ): Promise<SearchRow> {
    const [row] = await m.query<SearchRow[]>(
      'SELECT * FROM search_contexts WHERE id::text=$1 AND expires_at>now()',
      [id],
    );
    if (!row || !row.results.includes(vehicle))
      throw new AutosError(
        400,
        'VALIDATION_FAILED',
        'search_token inválido, expirado o vehículo fuera del resultado.',
      );
    return row;
  }
  private async available(
    m: EntityManager,
    id: string,
    route: Route,
    ignoreHold: string | null = null,
    ignoreOrder: string | null = null,
  ): Promise<VehicleRow> {
    const [v] = await m.query<VehicleRow[]>(
      'SELECT * FROM vehicles WHERE id::text=$1 FOR UPDATE',
      [id],
    );
    if (
      !v ||
      !v.active ||
      (!this.availability.canEvaluateReservation({
        status: v.status as VehicleStatus,
      }) &&
        v.status !== VehicleStatus.RESERVED)
    )
      throw new AutosError(
        409,
        'CAR_NO_LONGER_AVAILABLE',
        'Vehículo no operativo.',
      );
    const { start, end } = period(route);
    const pickup = await this.catalog.depotsFor(route.pickup.location, m),
      dropoff = await this.catalog.depotsFor(route.dropoff.location, m);
    if (
      !pickup.some((d) => d.id === v.depot_id) ||
      !dropoff.some((d) => d.supplier_id === v.supplier_id)
    )
      throw new AutosError(
        409,
        'DEPOT_CLOSED',
        'Ruta no atendida por el proveedor.',
      );
    const conflicts = await m.query<Array<{ id: string }>>(
      `SELECT id FROM orders WHERE vehicle_id=$1 AND status IN ('CONFIRMED','PENDING') AND starts_at<$3 AND ends_at>$2 AND ($5::uuid IS NULL OR id<>$5)
 UNION ALL SELECT id FROM holds WHERE vehicle_id=$1 AND NOT consumed AND expires_at>now() AND starts_at<$3 AND ends_at>$2 AND ($4::uuid IS NULL OR id<>$4)`,
      [v.id, start, end, ignoreHold, ignoreOrder],
    );
    if (conflicts.length)
      throw new AutosError(409, 'CAR_NO_LONGER_AVAILABLE', 'Período ocupado.');
    return v;
  }
  async hold(
    body: OrderHoldRequest,
    owner: string,
  ): Promise<OrderHoldResponse> {
    return this.db.transaction(async (m) => {
      const search = await this.context(m, body.search_token, body.vehicle_id);
      const v = await this.available(m, body.vehicle_id, search.context.route);
      const id = randomUUID(),
        expires = ttl('HOLD_TTL_MINUTES', 10),
        p = period(search.context.route);
      await m.query(
        'INSERT INTO holds(id,vehicle_id,owner_id,search_id,starts_at,ends_at,price_per_day,currency,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          id,
          v.id,
          owner,
          search.id,
          p.start,
          p.end,
          v.price_per_day,
          search.context.currency,
          expires,
        ],
      );
      return { hold_id: id, expires_at: expires.toISOString(), status: 'HELD' };
    });
  }
  async preview(
    body: OrderPreviewRequest,
    owner: string,
  ): Promise<OrderPreviewResponse> {
    return this.db.transaction(async (m) => {
      const search = await this.context(m, body.search_token, body.vehicle_id);
      let hold: HoldRow | undefined;
      if (body.hold_id !== undefined) {
        [hold] = await m.query<HoldRow[]>(
          'SELECT * FROM holds WHERE id::text=$1 AND owner_id=$2 AND NOT consumed AND expires_at>now()',
          [body.hold_id, owner],
        );
        if (
          !hold ||
          hold.search_id !== search.id ||
          hold.vehicle_id !== body.vehicle_id
        )
          throw new AutosError(
            409,
            'CAR_NO_LONGER_AVAILABLE',
            'Hold inválido o expirado.',
          );
      }
      const v = await this.available(
        m,
        body.vehicle_id,
        search.context.route,
        hold?.id ?? null,
      );
      // Revalidar después de esperar el bloqueo de vehículo.
      if (hold && hold.expires_at.getTime() <= Date.now())
        throw new AutosError(409, 'CAR_NO_LONGER_AVAILABLE', 'Hold expirado.');
      const rate = Number(hold?.price_per_day ?? v.price_per_day),
        extras = [...new Set(body.extras ?? [])],
        total = price(search.context.route, rate, extras),
        id = randomUUID();
      await m.query(
        'INSERT INTO order_previews(id,vehicle_id,owner_id,hold_id,route,price_per_day,total_amount,currency,extras,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          id,
          v.id,
          owner,
          hold?.id ?? null,
          search.context.route,
          rate,
          total,
          search.context.currency,
          JSON.stringify(extras),
          ttl('PREVIEW_TTL_MINUTES', 15),
        ],
      );
      return {
        request_id: randomUUID(),
        data: {
          order_preview_id: id,
          total_price: total,
          currency: search.context.currency,
          breakdown: {
            days: period(search.context.route).days,
            price_per_day: rate,
            extras,
          },
        },
      };
    });
  }
  private async idempotent<T>(
    owner: string,
    operation: string,
    key: string,
    body: unknown,
    status: number,
    action: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        fingerprint([owner, operation, key]),
      ]);
      const hash = createHash('sha256').update(fingerprint(body)).digest('hex');
      const [record] = await m.query<
        Array<{ request_hash: string; response_body: T }>
      >(
        'SELECT request_hash,response_body FROM idempotency_records WHERE owner_id=$1 AND operation=$2 AND key=$3',
        [owner, operation, key],
      );
      if (record) {
        if (record.request_hash !== hash)
          throw new AutosError(
            409,
            'BOOKING_NOT_CONFIRMED',
            'Idempotency-Key reutilizada con otro request.',
          );
        return record.response_body;
      }
      const result = await action(m);
      await m.query(
        'INSERT INTO idempotency_records(owner_id,operation,key,request_hash,status_code,response_body) VALUES($1,$2,$3,$4,$5,$6)',
        [
          owner,
          operation,
          key,
          hash,
          status,
          result === null ? null : JSON.stringify(result),
        ],
      );
      return result;
    });
  }
  async create(
    body: OrderCreateRequest,
    owner: string,
    key: string,
  ): Promise<OrderDetail> {
    return this.idempotent(owner, 'create', key, body, 201, async (m) => {
      const [preview] = await m.query<PreviewRow[]>(
        'SELECT * FROM order_previews WHERE id::text=$1 AND owner_id=$2 FOR UPDATE',
        [body.order_preview_id, owner],
      );
      if (
        !preview ||
        preview.consumed ||
        preview.expires_at.getTime() <= Date.now()
      )
        throw new AutosError(
          409,
          'BOOKING_NOT_CONFIRMED',
          'Preview inválido o expirado.',
        );
      await this.payment.verify(body.payment_reference);
      const v = await this.available(
        m,
        preview.vehicle_id,
        preview.route,
        preview.hold_id,
      );
      if (preview.hold_id) {
        const [h] = await m.query<HoldRow[]>(
          'SELECT * FROM holds WHERE id=$1 AND owner_id=$2 AND NOT consumed AND expires_at>now() FOR UPDATE',
          [preview.hold_id, owner],
        );
        if (!h)
          throw new AutosError(
            409,
            'CAR_NO_LONGER_AVAILABLE',
            'Hold expirado o consumido.',
          );
        await m.query(
          'UPDATE holds SET consumed=true,updated_at=now() WHERE id=$1',
          [h.id],
        );
      } else if (Number(v.price_per_day) !== Number(preview.price_per_day))
        throw new AutosError(
          409,
          'PRICE_CHANGED',
          'Tarifa cambió: generar otro preview.',
        );
      if (preview.expires_at.getTime() <= Date.now())
        throw new AutosError(409, 'BOOKING_NOT_CONFIRMED', 'Preview expirado.');
      const id = randomUUID(),
        p = period(preview.route),
        snapshot = {
          vehicle_id: v.id,
          brand_id: v.brand_id,
          model_id: v.model_id,
          seats: v.seats,
          doors: v.doors,
        };
      const [order] = await m.query<OrderRow[]>(
        `INSERT INTO orders(id,vehicle_id,owner_id,preview_id,locator,status,route,starts_at,ends_at,price_per_day,total_amount,currency,extras,vehicle_details,driver_details,payment_reference)
 VALUES($1,$2,$3,$4,$5,'CONFIRMED',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          id,
          v.id,
          owner,
          preview.id,
          'MDU-' + id,
          preview.route,
          p.start,
          p.end,
          preview.price_per_day,
          preview.total_amount,
          preview.currency,
          JSON.stringify(preview.extras),
          snapshot,
          body.driver_details,
          body.payment_reference,
        ],
      );
      await m.query(
        'UPDATE order_previews SET consumed=true,updated_at=now() WHERE id=$1',
        [preview.id],
      );
      await emitEvent(m, owner, 'CAR_ORDER_CONFIRMED', id, {
        order_id: id,
        status: 'CONFIRMED',
      });
      return this.detail(order);
    });
  }
  detail(o: OrderRow): OrderDetail {
    const base = (
      process.env.PUBLIC_AUTOS_BASE_URL ?? 'http://localhost:3000/autos/v1'
    ).replace(/\/$/, '');
    return {
      order_id: o.id,
      locator: o.locator,
      status: o.status,
      vehicle_details: o.vehicle_details,
      route_details: o.route,
      total_price: Number(o.total_amount),
      currency: o.currency,
      creation_date: o.created_at.toISOString(),
      _links: {
        self: base + '/orders/' + o.id,
        ...(o.status === 'CONFIRMED'
          ? {
              modify: base + '/orders/' + o.id + '/modify',
              cancel: base + '/orders/' + o.id + '/cancel',
            }
          : {}),
      },
    };
  }
  async get(id: string, owner: string): Promise<OrderDetail> {
    const [order] = await this.db.query<OrderRow[]>(
      'SELECT * FROM orders WHERE id=$1 AND owner_id=$2',
      [id, owner],
    );
    if (!order)
      throw new AutosError(
        404,
        'BOOKING_NOT_CONFIRMED',
        'Orden no encontrada.',
      );
    return this.detail(order);
  }
  async modify(
    id: string,
    body: OrderModifyRequest,
    owner: string,
    key: string,
  ): Promise<OrderDetail> {
    return this.idempotent(owner, 'modify:' + id, key, body, 200, async (m) => {
      const [o] = await m.query<OrderRow[]>(
        'SELECT * FROM orders WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, owner],
      );
      if (!o)
        throw new AutosError(
          404,
          'BOOKING_NOT_CONFIRMED',
          'Orden no encontrada.',
        );
      if (!body.route && !body.extras_to_add && !body.extras_to_remove)
        return this.detail(o);
      if (o.status !== 'CONFIRMED')
        throw new AutosError(
          409,
          'BOOKING_NOT_CONFIRMED',
          'Estado no modificable.',
        );
      const route = body.route ?? o.route;
      await this.available(m, o.vehicle_id, route, null, o.id);
      const extras = [
          ...new Set([
            ...o.extras.filter((x) => !body.extras_to_remove?.includes(x)),
            ...(body.extras_to_add ?? []),
          ]),
        ],
        total = price(route, Number(o.price_per_day), extras),
        p = period(route);
      const [updated] = await m.query<OrderRow[]>(
        'WITH updated AS (UPDATE orders SET route=$2,starts_at=$3,ends_at=$4,extras=$5,total_amount=$6,updated_at=now() WHERE id=$1 RETURNING *) SELECT * FROM updated',
        [id, route, p.start, p.end, JSON.stringify(extras), total],
      );
      return this.detail(updated);
    });
  }
  async cancel(id: string, owner: string, key: string): Promise<null> {
    return this.idempotent(owner, 'cancel:' + id, key, {}, 200, async (m) => {
      const [o] = await m.query<OrderRow[]>(
        'SELECT * FROM orders WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, owner],
      );
      if (!o)
        throw new AutosError(
          404,
          'BOOKING_NOT_CONFIRMED',
          'Orden no encontrada.',
        );
      if (o.status === 'CANCELLED') return null;
      if (o.starts_at.getTime() <= Date.now())
        throw new AutosError(
          409,
          'CANCELLATION_NOT_ALLOWED',
          'La recogida ya comenzó.',
        );
      await m.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE', [
        o.vehicle_id,
      ]);
      await m.query(
        "UPDATE orders SET status='CANCELLED',updated_at=now() WHERE id=$1",
        [id],
      );
      await emitEvent(m, owner, 'CAR_ORDER_CANCELLED', id, {
        order_id: id,
        status: 'CANCELLED',
      });
      return null;
    });
  }
}
