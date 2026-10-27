import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  CreateAutoOrderV2Dto,
  DeliveryCheckinV2Dto,
  MaintenanceV2Dto,
  PromotionAgreementV2Dto,
  ReturnCheckinV2Dto,
  SearchAutosV2Dto,
} from './autos-v2.dto';
import { InventoryStockOutboxService } from '../inventory/inventory-stock-outbox.service';

type Actor = { id: string; role: string; scopes: string[] };
type VehicleView = {
  id: string;
  brand: string;
  model: string;
  category: string;
  price_per_day: string;
  transmission: string;
  seats: number;
  doors: number;
  bag_capacity: number;
  mileage: number;
  next_maintenance_km: number;
  operational_status: string;
};

@Injectable()
export class AutosV2Service {
  private readonly startedAt = Date.now();
  constructor(
    private readonly db: DataSource,
    private readonly stockOutbox: InventoryStockOutboxService,
  ) {}

  async health() {
    const started = performance.now();
    const [metrics] = await this.db.query<Array<{ total: string; cooldown: string }>>(`
SELECT count(*)::text total,
 count(*) FILTER (WHERE operational_status='EN_LIMPIEZA')::text cooldown
FROM vehicles WHERE active`);
    return {
      status: 'HEALTHY',
      nodo_id: process.env.AUTOS_NODE_ID ?? 'maneja-de-una',
      nombre_proveedor: 'Maneja de Una',
      vertical: 'AUTOS',
      version: '2.0.0',
      uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
      latencia_ms: Math.round((performance.now() - started) * 100) / 100,
      circuit_breaker_estado: 'CLOSED',
      cooldown_activo_count: Number(metrics.cooldown),
      total_vehiculos: Number(metrics.total),
      timestamp: new Date().toISOString(),
    };
  }

  async promotion() {
    const [row] = await this.db.query<Array<Record<string, unknown>>>(
      'SELECT * FROM promotion_agreements WHERE id=true',
    );
    return this.promotionView(row);
  }

  async updatePromotion(body: PromotionAgreementV2Dto, actor: Actor) {
    const [row] = await this.db.query<Array<Record<string, unknown>>>(`
UPDATE promotion_agreements SET allows_promotions=$1,max_discount_percent=$2,
 enabled_destinations=$3,valid_until=$4,terms=$5,updated_by=$6,updated_at=now()
WHERE id=true RETURNING *`, [
      body.permite_promociones,
      body.porcentaje_descuento_maximo,
      JSON.stringify(body.destinos_habilitados ?? []),
      body.vigencia_hasta ?? null,
      body.condiciones_combo ?? null,
      actor.id,
    ]);
    return this.promotionView(row);
  }

  private promotionView(row: Record<string, unknown>) {
    return {
      proveedor_codigo: process.env.AUTOS_NODE_ID ?? 'maneja-de-una',
      nombre_socio: 'Maneja de Una',
      vertical: 'AUTOS',
      permite_promociones: row.allows_promotions,
      porcentaje_descuento_maximo: Number(row.max_discount_percent),
      destinos_habilitados: row.enabled_destinations,
      vigencia_hasta: row.valid_until,
      condiciones_combo: row.terms,
    };
  }

  async events(limit = 10, after?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.db.query<Array<Record<string, unknown>>>(`
SELECT * FROM webhook_outbox WHERE ($2::timestamptz IS NULL OR created_at>$2)
ORDER BY created_at,id LIMIT $1`, [safeLimit, after ?? null]);
    return {
      events: rows.map((row) => ({
        specversion: '1.0',
        type: `ec.manejadeluna.autos.${String(row.event_type).toLowerCase()}`,
        source: '/api/v2/autos',
        id: row.id,
        time: row.created_at,
        correlation_id: (row.data as Record<string, unknown>)?.correlation_id,
        datacontenttype: 'application/json',
        data: row.data,
      })),
      metadata: { count: rows.length, next_after: rows.at(-1)?.created_at ?? null },
    };
  }

  async catalog(category = 'ALL', transmission = 'ALL', limit = 10) {
    const rows = await this.vehicleRows(
      undefined,
      undefined,
      category,
      transmission,
      Math.min(Math.max(limit, 0), 100),
    );
    return { data: rows.map((row) => this.card(row)) };
  }

  async search(body: SearchAutosV2Dto) {
    const start = this.dateTime(body.pickup_date, body.pickup_time);
    const end = this.dateTime(body.dropoff_date, body.dropoff_time);
    if (start >= end) throw new ConflictException('La devolución debe ser posterior a la recogida.');
    const age = body.driver_age ?? this.bracketAge(body.driver_age_bracket);
    if (age < 18) throw new UnprocessableEntityException('El conductor debe ser mayor de edad.');
    const rows = await this.vehicleRows(
      start,
      end,
      body.category ?? 'ALL',
      body.transmission ?? 'ALL',
      100,
      body.pickup_location,
    );
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const surcharge = age < 25 || age > 70 ? 1.15 : 1;
    return {
      request_id: randomUUID(),
      metadata: { total_results: rows.length, driver_age_surcharge_applied: surcharge > 1 },
      data: rows.map((row) => this.card(row, days, surcharge)),
    };
  }

  async fleet() {
    await this.releaseCooldowns();
    const rows = await this.vehicleRows(undefined, undefined, 'ALL', 'ALL', 1000);
    const cooldowns = await this.db.query<Array<{ vehicle_id: string; ends_at: Date }>>(
      'SELECT vehicle_id,ends_at FROM vehicle_cooldowns WHERE completed_at IS NULL AND ends_at>now()',
    );
    const byVehicle = new Map(cooldowns.map((c) => [c.vehicle_id, c.ends_at]));
    return rows.map((row) => {
      const end = byVehicle.get(row.id);
      return {
        id: row.id,
        marca: row.brand,
        modelo: row.model,
        categoria: row.category,
        precio_diario: Number(row.price_per_day),
        estado_operativo: row.operational_status,
        cooldown_activo: Boolean(end),
        segundos_restantes_cooldown: end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000)) : 0,
        disponible_estimado_at: end ?? null,
        kilometraje_actual: row.mileage,
        umbral_mantenimiento_km: row.next_maintenance_km,
        alerta_mantenimiento: row.mileage >= row.next_maintenance_km,
      };
    });
  }

  async vehicle(id: string) {
    const rows = await this.vehicleRows(undefined, undefined, 'ALL', 'ALL', 1, undefined, id);
    if (!rows[0]) throw new NotFoundException('Vehículo no encontrado.');
    return this.card(rows[0]);
  }

  async coverages(id: string) {
    const vehicle = await this.vehicle(id);
    const rows = await this.db.query<Array<Record<string, unknown>>>(
      'SELECT * FROM coverage_plans WHERE active ORDER BY daily_price',
    );
    return {
      auto_id: id,
      vehiculo: `${vehicle.marca} ${vehicle.modelo}`,
      opciones: rows.map((row) => ({
        codigo: row.code,
        nombre: row.name,
        precio_diario: Number(row.daily_price),
        franquicia: Number(row.deductible),
        deposito_garantia: Number(row.deposit),
        descripcion: row.description,
      })),
    };
  }

  async orders(actor: Actor) {
    const rows = await this.db.query<Array<Record<string, unknown>>>(
      `SELECT * FROM orders WHERE ($1 OR owner_id=$2) ORDER BY created_at DESC LIMIT 200`,
      [actor.role === 'ADMIN' || actor.role === 'INTEGRATION', actor.id],
    );
    return rows.map((row) => this.orderView(row));
  }

  async order(id: string, actor: Actor) {
    const [row] = await this.db.query<Array<Record<string, unknown>>>(
      `SELECT * FROM orders WHERE (id::text=$1 OR locator=$1) AND ($2 OR owner_id=$3)`,
      [id, actor.role === 'ADMIN' || actor.role === 'INTEGRATION', actor.id],
    );
    if (!row) throw new NotFoundException('Reserva no encontrada.');
    return this.orderView(row);
  }

  async createOrder(body: CreateAutoOrderV2Dto, actor: Actor, key: string, correlationId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
      throw new ConflictException('Idempotency-Key UUID v4 requerido.');
    const start = this.dateTime(body.pickup_date, body.hora_recogida ?? '10:00');
    const end = this.dateTime(body.dropoff_date, body.hora_devolucion ?? '10:00');
    if (start >= end) throw new ConflictException('Período de reserva inválido.');
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${actor.id}:${key}`]);
      const [replay] = await m.query<Array<{ response_body: unknown }>>(
        "SELECT response_body FROM idempotency_records WHERE owner_id=$1 AND operation='autos-v2:create' AND key=$2",
        [actor.id, key],
      );
      if (replay) return replay.response_body;
      const [vehicle] = await m.query<Array<VehicleView & { active: boolean }>>(
        'SELECT v.*,b.name brand,vm.name model,c.name category FROM vehicles v JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id JOIN categories c ON c.id=v.category_id WHERE v.id=$1 FOR UPDATE OF v',
        [body.vehicle_id],
      );
      if (!vehicle?.active) throw new NotFoundException('Vehículo no encontrado.');
      await this.ensureAvailable(m, vehicle, start, end);
      const coverage = body.tipo_cobertura ?? 'BASICA';
      const [plan] = await m.query<Array<{ daily_price: string; deposit: string }>>(
        'SELECT daily_price,deposit FROM coverage_plans WHERE code=$1 AND active',
        [coverage],
      );
      if (!plan) throw new ConflictException('Cobertura inválida.');
      const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
      const total = days * (Number(vehicle.price_per_day) + Number(plan.daily_price));
      const id = randomUUID();
      const locator = `MDU-${id.slice(0, 8).toUpperCase()}`;
      const route = {
        pickup: { datetime: start.toISOString(), location: { name: body.pickup_location } },
        dropoff: { datetime: end.toISOString(), location: { name: body.dropoff_location } },
      };
      const [created] = await m.query<Array<Record<string, unknown>>>(`
INSERT INTO orders(id,vehicle_id,owner_id,locator,status,route,starts_at,ends_at,price_per_day,total_amount,currency,extras,vehicle_details,driver_details,coverage_type)
VALUES($1,$2,$3,$4,'CONFIRMED',$5,$6,$7,$8,$9,'USD','[]',$10,$11,$12) RETURNING *`,
      [id, vehicle.id, actor.id, locator, route, start, end, vehicle.price_per_day, total,
        { vehicle_id: vehicle.id, brand: vehicle.brand, model: vehicle.model }, body.conductor, coverage]);
      await this.history(m, id, null, 'CONFIRMED', actor.id, correlationId);
      await this.event(m, actor.id, 'AUTO_ORDER_CONFIRMED', id, correlationId, { order_id: id, vehicle_id: vehicle.id });
      await this.stockOutbox.enqueue(m, vehicle.id, start, 0, correlationId);
      const response = this.orderView(created, Number(plan.deposit));
      await m.query(`INSERT INTO idempotency_records(owner_id,operation,key,request_hash,status_code,response_body)
VALUES($1,'autos-v2:create',$2,$3,201,$4)`, [actor.id, key, JSON.stringify(body), response]);
      return response;
    });
  }

  async digitalCheckin(id: string, actor: Actor, correlationId: string) {
    return this.db.transaction(async (m) => {
      const order = await this.lockOrder(m, id, actor);
      if (order.status !== 'CONFIRMED') throw new ConflictException('Reserva no confirmada.');
      const [updated] = await m.query<Array<Record<string, unknown>>>(
        'UPDATE orders SET digital_checkin_at=COALESCE(digital_checkin_at,now()),updated_at=now() WHERE id=$1 RETURNING *',
        [order.id],
      );
      await m.query("UPDATE vehicles SET operational_status='LISTO_PARA_ENTREGAR',updated_at=now() WHERE id=$1 AND operational_status IN ('DISPONIBLE','RESERVADO')", [order.vehicle_id]);
      await this.history(m, String(order.id), String(order.status), 'CHECKIN_DIGITAL', actor.id, correlationId);
      return {
        reserva_id: updated.id,
        pnr: updated.locator,
        checkin_status: 'COMPLETADO',
        fast_track_pickup: true,
        mensaje: 'Check-in digital completado.',
        voucher_qr_data: `MDU:${String(updated.locator)}:${String(updated.id).slice(0, 8)}`,
        requisitos: ['Presentar licencia física vigente'],
      };
    });
  }

  async delivery(id: string, body: DeliveryCheckinV2Dto, actor: Actor, correlationId: string) {
    return this.db.transaction(async (m) => {
      const order = await this.lockOrder(m, id, actor);
      if (!order.digital_checkin_at || order.delivered_at) throw new ConflictException('Transición de entrega no permitida.');
      const [vehicle] = await m.query<Array<{ mileage: number }>>('SELECT mileage FROM vehicles WHERE id=$1 FOR UPDATE', [order.vehicle_id]);
      if (body.km_salida < vehicle.mileage) throw new ConflictException('El kilometraje inicial no puede disminuir.');
      await m.query('UPDATE orders SET delivered_at=now(),initial_mileage=$2,delivery_agent=$3,updated_at=now() WHERE id=$1', [order.id, body.km_salida, body.tecnico_entrega ?? actor.id]);
      await m.query("UPDATE vehicles SET mileage=$2,operational_status='ENTREGADO',updated_at=now() WHERE id=$1", [order.vehicle_id, body.km_salida]);
      await m.query(`INSERT INTO rental_inspections(id,order_id,vehicle_id,inspection_type,mileage,agent_id)
VALUES($1,$2,$3,'ENTREGA',$4,$5) ON CONFLICT(order_id,inspection_type) DO NOTHING`, [randomUUID(), order.id, order.vehicle_id, body.km_salida, actor.id]);
      await this.history(m, String(order.id), 'CHECKIN_DIGITAL', 'ENTREGADO', actor.id, correlationId);
      return { success: true, order_id: order.id, pnr: order.locator, estado_orden: 'ENTREGADO', km_salida: body.km_salida, licencia_verificada: true, mensaje: 'Vehículo entregado.' };
    });
  }

  async returnOrder(id: string, body: ReturnCheckinV2Dto, actor: Actor, correlationId: string) {
    return this.db.transaction(async (m) => {
      const order = await this.lockOrder(m, id, actor);
      if (!order.delivered_at || order.returned_at || order.initial_mileage === null) throw new ConflictException('Transición de devolución no permitida.');
      if (body.km_retorno < Number(order.initial_mileage)) throw new ConflictException('El kilometraje final no puede ser inferior al inicial.');
      const end = new Date(Date.now() + 120 * 60 * 1000);
      const fuel = body.nivel_combustible ?? 100;
      await m.query("UPDATE orders SET returned_at=now(),final_mileage=$2,status='COMPLETED',updated_at=now() WHERE id=$1", [order.id, body.km_retorno]);
      await m.query("UPDATE vehicles SET mileage=$2,fuel_level=$3,operational_status='EN_LIMPIEZA',updated_at=now() WHERE id=$1", [order.vehicle_id, body.km_retorno, fuel]);
      await m.query(`INSERT INTO rental_inspections(id,order_id,vehicle_id,inspection_type,mileage,fuel_level,notes,agent_id)
VALUES($1,$2,$3,'DEVOLUCION',$4,$5,$6,$7)`, [randomUUID(), order.id, order.vehicle_id, body.km_retorno, fuel, body.observaciones ?? null, actor.id]);
      await m.query('INSERT INTO vehicle_cooldowns(id,vehicle_id,order_id,starts_at,ends_at) VALUES($1,$2,$3,now(),$4)', [randomUUID(), order.vehicle_id, order.id, end]);
      await this.history(m, String(order.id), 'ENTREGADO', 'EN_LIMPIEZA', actor.id, correlationId);
      await this.event(m, actor.id, 'AUTO_CLEANING_COOLDOWN_STARTED', String(order.id), correlationId, { order_id: order.id, vehicle_id: order.vehicle_id, ends_at: end });
      return { success: true, order_id: order.id, pnr: order.locator, estado_orden: 'COMPLETED', km_retorno: body.km_retorno, km_recorridos: body.km_retorno - Number(order.initial_mileage), cooldown: { cooldown_horas: 2, activo: true, fin_cooldown: end, proximo_estado: 'DISPONIBLE' } };
    });
  }

  async cancel(id: string, actor: Actor, correlationId: string) {
    return this.db.transaction(async (m) => {
      const order = await this.lockOrder(m, id, actor);
      if (order.status === 'CANCELLED') return this.orderView(order);
      if (order.delivered_at) throw new ConflictException('No puede cancelarse un alquiler ya entregado.');
      const refund = `MOCK-REFUND-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [updated] = await m.query<Array<Record<string, unknown>>>(
        "UPDATE orders SET status='CANCELLED',refund_reference=$2,updated_at=now() WHERE id=$1 RETURNING *",
        [order.id, refund],
      );
      await this.history(m, String(order.id), String(order.status), 'CANCELLED', actor.id, correlationId);
      await this.event(m, actor.id, 'AUTO_ORDER_CANCELLED', String(order.id), correlationId, { order_id: order.id, refund_reference: refund, simulated: true });
      await this.stockOutbox.enqueue(
        m,
        String(order.vehicle_id),
        new Date(String(order.starts_at)),
        1,
        correlationId,
      );
      return this.orderView(updated);
    });
  }

  async maintenance(id: string, body: MaintenanceV2Dto, actor: Actor, correlationId: string) {
    return this.db.transaction(async (m) => {
      const [vehicle] = await m.query<Array<VehicleView>>('SELECT * FROM vehicles WHERE id=$1 AND active FOR UPDATE', [id]);
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado.');
      if (body.kilometraje_registrado < vehicle.mileage) throw new ConflictException('El kilometraje no puede disminuir.');
      const next = body.nuevo_proximo_mantenimiento_km ?? vehicle.next_maintenance_km;
      if (body.mantenimiento_realizado && next < body.kilometraje_registrado) throw new ConflictException('El próximo mantenimiento debe ser futuro.');
      const recordId = randomUUID();
      await m.query(`INSERT INTO maintenance_records(id,vehicle_id,technician_id,mileage,fuel_level,body_condition,tire_condition,notes,maintenance_performed,next_maintenance_km)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [recordId, id, body.tecnico_id, body.kilometraje_registrado, body.nivel_combustible, body.condiciones_carroceria ?? null, body.estado_neumaticos ?? null, body.observaciones ?? null, body.mantenimiento_realizado ?? false, next]);
      const required = !(body.mantenimiento_realizado ?? false) && body.kilometraje_registrado >= next;
      const state = required ? 'EN_MANTENIMIENTO' : body.mantenimiento_realizado ? 'DISPONIBLE' : vehicle.operational_status;
      await m.query('UPDATE vehicles SET mileage=$2,fuel_level=$3,next_maintenance_km=$4,operational_status=$5,updated_at=now() WHERE id=$1', [id, body.kilometraje_registrado, body.nivel_combustible, next, state]);
      if (required) await this.event(m, actor.id, 'AUTO_MAINTENANCE_ALERT', id, correlationId, { vehicle_id: id, mileage: body.kilometraje_registrado, next_maintenance_km: next });
      return { auto_id: id, kilometraje_actual: body.kilometraje_registrado, proximo_mantenimiento_km: next, mantenimiento_requerido: required, alerta_preventiva: required, nivel_combustible: body.nivel_combustible, bitacora_id: recordId, timestamp: new Date().toISOString() };
    });
  }

  async returnByVehicle(id: string, actor: Actor, correlationId: string) {
    const [order] = await this.db.query<Array<{ id: string; initial_mileage: number; mileage: number }>>(`
SELECT o.id,o.initial_mileage,v.mileage FROM orders o JOIN vehicles v ON v.id=o.vehicle_id
WHERE o.vehicle_id=$1 AND o.delivered_at IS NOT NULL AND o.returned_at IS NULL ORDER BY o.delivered_at DESC LIMIT 1`, [id]);
    if (!order) throw new NotFoundException('No existe alquiler entregado para el vehículo.');
    const response = await this.returnOrder(order.id, { km_retorno: Math.max(order.mileage, order.initial_mileage), nivel_combustible: 100 }, actor, correlationId);
    return { auto_id: id, estado: 'EN_LIMPIEZA', cooldown_horas: 2, disponible_desde: response.cooldown.fin_cooldown, mensaje: 'Devolución registrada; limpieza iniciada.' };
  }

  private async vehicleRows(start?: Date, end?: Date, category = 'ALL', transmission = 'ALL', limit = 100, location?: string, id?: string) {
    await this.releaseCooldowns();
    return this.db.query<VehicleView[]>(`
SELECT v.*,b.name brand,vm.name model,c.name category FROM vehicles v
JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id
JOIN categories c ON c.id=v.category_id JOIN locations l ON l.id=v.location_id
WHERE v.active AND ($1::text IS NULL OR v.id::text=$1)
 AND ($2='ALL' OR upper(c.name)=upper($2))
 AND ($3='ALL' OR upper(v.transmission)=upper($3) OR ($3='AUTOMATICO' AND upper(v.transmission)='AUTOMATIC'))
 AND ($4::text IS NULL OR lower(l.city)=lower($4) OR lower(l.name)=lower($4))
 AND v.operational_status NOT IN ('ENTREGADO','EN_LIMPIEZA','EN_MANTENIMIENTO')
 AND ($5::timestamptz IS NULL OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.vehicle_id=v.id AND o.status IN ('PENDING','CONFIRMED') AND o.starts_at<$6 AND o.ends_at>$5))
ORDER BY v.price_per_day,v.id LIMIT $7`, [id ?? null, category, transmission, location ?? null, start ?? null, end ?? null, limit]);
  }

  private card(row: VehicleView, days = 1, surcharge = 1) {
    const daily = Number(row.price_per_day);
    return {
      vehicle_id: row.id, auto_id: row.id, id: row.id,
      marca: row.brand, brand: row.brand, modelo: row.model, model: row.model,
      categoria: row.category, category: row.category,
      precio_diario: daily, daily_price: daily,
      precio_total: Math.round(daily * days * surcharge * 100) / 100,
      total_price_usd: Math.round(daily * days * surcharge * 100) / 100,
      moneda: 'USD', currency: 'USD', transmision: row.transmission, transmission: row.transmission,
      asientos: row.seats, seats: row.seats, puertas: row.doors, doors: row.doors,
      maletas_grandes: row.bag_capacity, maletas_pequenas: 1, aire_acondicionado: true,
      kilometraje_ilimitado: true, politica_combustible: 'LLENO_A_LLENO', cancelacion_gratuita: true,
      estado: row.operational_status, kilometraje_actual: row.mileage,
      proximo_mantenimiento_km: row.next_maintenance_km,
      mantenimiento_requerido: row.mileage >= row.next_maintenance_km,
    };
  }

  private orderView(row: Record<string, unknown>, deposit = 0) {
    return {
      order_id: row.id,
      pnr: row.locator,
      codigo_reserva: row.locator,
      status: row.status,
      estado: row.status,
      auto_id: row.vehicle_id,
      tipo_cobertura: row.coverage_type ?? 'BASICA',
      deposito_garantia: deposit,
      total_price: Number(row.total_amount),
      precio_total_monto: Number(row.total_amount),
      moneda: row.currency,
      refund: row.refund_reference ? { id: row.refund_reference, status: 'MOCK_PROCESSED' } : undefined,
      reembolso_id: row.refund_reference,
      _links: {
        self: `/api/v2/autos/orders/${String(row.id)}`,
        cancel: `/api/v2/autos/orders/${String(row.id)}/cancel`,
      },
    };
  }

  private async ensureAvailable(m: EntityManager, vehicle: VehicleView, start: Date, end: Date) {
    if (['ENTREGADO', 'EN_MANTENIMIENTO'].includes(vehicle.operational_status)) throw new ConflictException('Vehículo no disponible operativamente.');
    const [cooldown] = await m.query<Array<{ ends_at: Date }>>('SELECT ends_at FROM vehicle_cooldowns WHERE vehicle_id=$1 AND completed_at IS NULL AND ends_at>$2 AND starts_at<$3', [vehicle.id, start, end]);
    if (cooldown) throw new ConflictException(`VEHICLE_IN_CLEANING_COOLDOWN hasta ${cooldown.ends_at.toISOString()}.`);
    const [conflict] = await m.query<Array<{ id: string }>>("SELECT id FROM orders WHERE vehicle_id=$1 AND status IN ('PENDING','CONFIRMED') AND starts_at<$3 AND ends_at>$2 LIMIT 1", [vehicle.id, start, end]);
    if (conflict) throw new ConflictException('El vehículo ya está reservado para ese período.');
  }

  private async lockOrder(m: EntityManager, id: string, actor: Actor) {
    const [row] = await m.query<Array<Record<string, unknown>>>(`SELECT * FROM orders
WHERE (id::text=$1 OR locator=$1) AND ($2 OR owner_id=$3) FOR UPDATE`, [id, actor.role === 'ADMIN' || actor.role === 'INTEGRATION', actor.id]);
    if (!row) throw new NotFoundException('Reserva no encontrada.');
    return row;
  }

  private async releaseCooldowns() {
    await this.db.transaction(async (m) => {
      const rows = await m.query<Array<{ id: string; vehicle_id: string; mileage: number; next_maintenance_km: number }>>(`
SELECT vc.id,vc.vehicle_id,v.mileage,v.next_maintenance_km FROM vehicle_cooldowns vc
JOIN vehicles v ON v.id=vc.vehicle_id WHERE vc.completed_at IS NULL AND vc.ends_at<=now() FOR UPDATE OF vc,v`);
      for (const row of rows) {
        const state = row.mileage >= row.next_maintenance_km ? 'EN_MANTENIMIENTO' : 'DISPONIBLE';
        await m.query('UPDATE vehicle_cooldowns SET completed_at=now() WHERE id=$1', [row.id]);
        await m.query('UPDATE vehicles SET operational_status=$2,updated_at=now() WHERE id=$1', [row.vehicle_id, state]);
      }
    });
  }

  private dateTime(date: string, time: string) {
    const value = new Date(`${date}T${time}:00-05:00`);
    if (!Number.isFinite(value.getTime())) throw new ConflictException('Fecha u hora inválida.');
    return value;
  }

  private bracketAge(value?: string) {
    return value === 'JOVEN' ? 21 : value === 'SENIOR' ? 75 : 30;
  }

  private history(m: EntityManager, orderId: string, from: string | null, to: string, actor: string, correlationId: string) {
    return m.query('INSERT INTO reservation_status_history(id,order_id,from_status,to_status,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), orderId, from, to, actor, correlationId]);
  }

  private event(m: EntityManager, owner: string, type: string, resource: string, correlationId: string, data: Record<string, unknown>) {
    return m.query('INSERT INTO webhook_outbox(id,owner_id,event_type,resource_id,data) VALUES($1,$2,$3,$4,$5)', [randomUUID(), owner, type, resource, { ...data, correlation_id: correlationId }]);
  }
}
