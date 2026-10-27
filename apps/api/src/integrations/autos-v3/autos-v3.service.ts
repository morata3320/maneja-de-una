import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateAutoOrderV2Dto } from '../autos-v2/autos-v2.dto';
import { AutosV2Service } from '../autos-v2/autos-v2.service';
import type { AutosV2Request } from '../autos-v2/autos-v2.guard';
import type { CreateAutoOrderV3Dto } from './autos-v3.dto';
import { AutosV3ProblemException } from './autos-v3-problem.exception';

type Actor = AutosV2Request['actor'];

@Injectable()
export class AutosV3Service {
  constructor(private readonly autos: AutosV2Service) {}

  async health() {
    return { ...(await this.autos.health()), version: '3.0.0' };
  }

  async catalog(category?: string, transmission?: string, limit?: number) {
    const response = await this.autos.catalog(category, transmission, limit);
    return { total: response.data.length, limit: limit ?? 10, ...response };
  }

  async create(
    body: CreateAutoOrderV3Dto,
    actor: Actor,
    key: string,
    correlationId: string,
  ) {
    if (body.driver.age < 18)
      throw new AutosV3ProblemException(
        422,
        'DRIVER_UNDERAGE',
        'El conductor debe tener al menos 18 años.',
      );
    const internal = {
      vehicle_id: body.vehicle_id,
      pickup_date: body.pickup_date,
      dropoff_date: body.dropoff_date,
      hora_recogida: body.pickup_time ?? '10:00',
      hora_devolucion: body.dropoff_time ?? '10:00',
      pickup_location: body.pickup_location,
      dropoff_location: body.dropoff_location,
      tipo_cobertura:
        body.coverage_type === 'BASIC'
          ? 'BASICA'
          : (body.coverage_type ?? 'BASICA'),
      conductor: {
        nombre: body.driver.full_name,
        documento: body.driver.license_number,
        edad: body.driver.age,
        full_name: body.driver.full_name,
        email: body.driver.email,
        phone: body.driver.phone,
        license_number: body.driver.license_number,
        country_license: body.driver.country_license,
        flight_number: body.driver.flight_number,
      },
    } as CreateAutoOrderV2Dto;
    try {
      const order = await this.autos.createOrder(
        internal,
        actor,
        key,
        correlationId,
      );
      return this.v3Order(order as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ConflictException) {
        const response = error.getResponse();
        const message =
          typeof response === 'object' &&
          response !== null &&
          'message' in response
            ? response.message
            : undefined;
        const detail =
          typeof response === 'string'
            ? response
            : typeof message === 'string'
              ? message
              : 'Vehículo no disponible.';
        throw new AutosV3ProblemException(409, 'VEHICLE_UNAVAILABLE', detail);
      }
      throw error;
    }
  }

  async order(id: string, actor: Actor) {
    return this.v3Order(await this.autos.order(id, actor));
  }

  async orders(actor: Actor) {
    return (await this.autos.orders(actor)).map((order) => this.v3Order(order));
  }

  async cancel(id: string, actor: Actor, correlationId: string) {
    return this.v3Order(await this.autos.cancel(id, actor, correlationId));
  }

  private v3Order(order: Record<string, unknown>) {
    const status = order.status === 'CONFIRMED' ? 'RESERVADO' : order.status;
    return {
      ...order,
      status,
      estado: status,
      vehicle_id: order.auto_id,
      voucher_qr_payload: `BOOKING-CAR-${String(order.pnr)}`,
      voucher_qr_data: `BOOKING-CAR-${String(order.pnr)}`,
      total_price: {
        currency: order.moneda ?? 'USD',
        total: order.precio_total_monto,
      },
      coverage_type: order.tipo_cobertura,
    };
  }
}
