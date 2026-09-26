import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import type {
  CarSearchRequest,
  CarSearchResponse,
  CarDetailsRequest,
  CarDetailsResponse,
  DepotsRequest,
  DepotsResponse,
  DepotScoresRequest,
  DepotScoresResponse,
  SuppliersRequest,
  SuppliersResponse,
  CarConstantsRequest,
  CarConstantsResponse,
  LocationPoint,
} from './contract/autos.types';
import type { DepotRow, VehicleRow } from '../../persistence/rows';
import {
  period,
  price,
  fingerprint,
  pageOffset,
  pageToken,
  limitSize,
  ttl,
} from './autos-policy';
import { FuelType, Transmission } from '../../vehicles/domain/vehicle.enums';
@Injectable()
export class CatalogService {
  constructor(private readonly db: DataSource) {}
  async depotsFor(
    point: LocationPoint,
    m: EntityManager = this.db.manager,
  ): Promise<DepotRow[]> {
    return m.query<DepotRow[]>(
      `SELECT d.* FROM depots d JOIN locations l ON l.id=d.location_id JOIN suppliers s ON s.id=d.supplier_id WHERE d.active AND l.active AND s.active
 AND ($1::text IS NULL OR d.airport=$1) AND ($2::int IS NULL OR d.city_id=$2)
 AND ($3::numeric IS NULL OR abs(d.latitude-$3)<0.5) AND ($4::numeric IS NULL OR abs(d.longitude-$4)<0.5) ORDER BY d.id`,
      [
        point.airport ?? null,
        point.city_id ?? null,
        point.coordinates?.latitude ?? null,
        point.coordinates?.longitude ?? null,
      ],
    );
  }
  private pagination(
    request: object,
    affiliate: string,
    resource: string,
  ): { offset: number; limit: number; context: string } {
    const { page, ...filters } = request as {
      page?: string;
      maximum_results?: number;
    };
    const context = createHash('sha256')
      .update(fingerprint({ affiliate, resource, filters }))
      .digest('hex');
    return {
      offset: pageOffset(page, context),
      limit: limitSize(filters.maximum_results),
      context,
    };
  }
  async search(
    body: CarSearchRequest,
    affiliate: string,
  ): Promise<CarSearchResponse> {
    const { start, end } = period(body.route);
    const pickup = await this.depotsFor(body.route.pickup.location),
      dropoff = await this.depotsFor(body.route.dropoff.location);
    const rows = await this.db.query<VehicleRow[]>(
      `SELECT v.* FROM vehicles v JOIN brands b ON b.id=v.brand_id JOIN vehicle_models vm ON vm.id=v.model_id JOIN categories c ON c.id=v.category_id
 WHERE v.active AND b.active AND vm.active AND c.active AND v.status IN ('AVAILABLE','RESERVED')
 AND v.depot_id=ANY($1::int[]) AND v.supplier_id=ANY($2::int[])
 AND ($5::text[] IS NULL OR c.name=ANY($5)) AND ($6::text[] IS NULL OR v.transmission=ANY($6))
 AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.vehicle_id=v.id AND o.status IN ('CONFIRMED','PENDING') AND o.starts_at<$4 AND o.ends_at>$3)
 AND NOT EXISTS(SELECT 1 FROM holds h WHERE h.vehicle_id=v.id AND NOT h.consumed AND h.expires_at>now() AND h.starts_at<$4 AND h.ends_at>$3)
 ORDER BY v.id`,
      [
        pickup.map((d) => d.id),
        dropoff.map((d) => d.supplier_id),
        start,
        end,
        body.filters?.car_types?.length ? body.filters.car_types : null,
        body.filters?.transmission?.length ? body.filters.transmission : null,
      ],
    );
    const p = this.pagination(body, affiliate, 'search');
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO search_contexts(id,affiliate,context,results,expires_at) VALUES($1,$2,$3,$4,$5)',
      [
        id,
        affiliate,
        body,
        rows.map((v) => v.id),
        ttl('SEARCH_TOKEN_TTL_MINUTES', 30),
      ],
    );
    const selected = rows.slice(p.offset, p.offset + p.limit);
    return {
      request_id: randomUUID(),
      search_token: id,
      data: selected.map((v) => ({
        vehicle_id: v.id,
        price: price(body.route, Number(v.price_per_day), []),
        supplier_id: v.supplier_id,
      })),
      metadata: {
        total_results: rows.length,
        next_page:
          p.limit > 0 && p.offset + p.limit < rows.length
            ? pageToken(p.offset + p.limit, p.context)
            : null,
      },
    };
  }
  async depots(
    body: DepotsRequest,
    affiliate: string,
  ): Promise<DepotsResponse> {
    const p = this.pagination(body, affiliate, 'depots');
    const rows = await this.db.query<DepotRow[]>(
      'SELECT * FROM depots WHERE active AND ($1::timestamptz IS NULL OR updated_at>$1) ORDER BY id',
      [body.last_modified ?? null],
    );
    return {
      request_id: randomUUID(),
      data: rows.slice(p.offset, p.offset + p.limit).map((d) => ({
        depot_id: d.id,
        name: d.name,
        location: {
          ...(d.airport !== null ? { airport: d.airport } : {}),
          ...(d.city_id !== null ? { city_id: d.city_id } : {}),
          ...(d.latitude !== null && d.longitude !== null
            ? {
                coordinates: {
                  latitude: Number(d.latitude),
                  longitude: Number(d.longitude),
                },
              }
            : {}),
        },
      })),
      metadata: {
        total_results: rows.length,
        next_page:
          p.limit > 0 && p.offset + p.limit < rows.length
            ? pageToken(p.offset + p.limit, p.context)
            : null,
      },
    };
  }
  async scores(
    body: DepotScoresRequest,
    affiliate: string,
  ): Promise<DepotScoresResponse> {
    const p = this.pagination(body, affiliate, 'scores');
    const rows = await this.db.query<
      Array<{ depot_id: number; score: string }>
    >(
      'SELECT s.depot_id,s.score FROM depot_scores s JOIN depots d ON d.id=s.depot_id WHERE d.active ORDER BY depot_id',
    );
    return {
      request_id: randomUUID(),
      data: rows
        .slice(p.offset, p.offset + p.limit)
        .map((r) => ({ depot_id: r.depot_id, score: Number(r.score) })),
      metadata: {
        total_results: rows.length,
        next_page:
          p.limit > 0 && p.offset + p.limit < rows.length
            ? pageToken(p.offset + p.limit, p.context)
            : null,
      },
    };
  }
  async details(
    body: CarDetailsRequest,
    affiliate: string,
  ): Promise<CarDetailsResponse> {
    const p = this.pagination(body, affiliate, 'details');
    const rows = await this.db.query<
      Array<VehicleRow & { make: string; model: string }>
    >(
      'SELECT v.*,b.name AS make,m.name AS model FROM vehicles v JOIN brands b ON b.id=v.brand_id JOIN vehicle_models m ON m.id=v.model_id WHERE v.active AND ($1::timestamptz IS NULL OR v.updated_at>$1) ORDER BY v.id',
      [body.last_modified ?? null],
    );
    return {
      request_id: randomUUID(),
      data: rows.slice(p.offset, p.offset + p.limit).map((v) => ({
        vehicle_id: v.id,
        make: v.make,
        model: v.model,
        doors: v.doors,
        bag_capacity: v.bag_capacity,
        seats: v.seats,
      })),
      metadata: {
        next_page:
          p.limit > 0 && p.offset + p.limit < rows.length
            ? pageToken(p.offset + p.limit, p.context)
            : null,
        total_results: rows.length,
      },
    };
  }
  async suppliers(
    body: SuppliersRequest,
    affiliate: string,
  ): Promise<SuppliersResponse> {
    const p = this.pagination(body, affiliate, 'suppliers');
    const rows = await this.db.query<Array<{ id: number; name: string }>>(
      'SELECT id,name FROM suppliers WHERE active AND ($1::int[] IS NULL OR id=ANY($1)) ORDER BY id',
      [body.suppliers?.length ? body.suppliers : null],
    );
    return {
      request_id: randomUUID(),
      data: rows
        .slice(p.offset, p.offset + p.limit)
        .map((r) => ({ supplier_id: r.id, name: r.name })),
      metadata: {
        next_page:
          p.limit > 0 && p.offset + p.limit < rows.length
            ? pageToken(p.offset + p.limit, p.context)
            : null,
        total_results: rows.length,
      },
    };
  }
  constants(body: CarConstantsRequest): CarConstantsResponse {
    const values: Record<string, unknown> = {
      depot_services: ['PICKUP', 'DROPOFF'],
      fuel_policies: ['SAME_TO_SAME'],
      fuel_types: Object.values(FuelType),
      general: {
        extras: { GPS: 5, CHILD_SEAT: 10 },
        pricing: 'daily',
        day_hours: 24,
      },
      payment_timings: ['EXTERNAL_REFERENCE'],
      transmission: Object.values(Transmission),
    };
    return {
      request_id: randomUUID(),
      data: Object.fromEntries(
        (body.constants?.length ? body.constants : Object.keys(values)).map(
          (k) => [k, values[k]],
        ),
      ),
    };
  }
}
