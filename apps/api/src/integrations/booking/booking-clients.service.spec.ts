import type { DataSource, EntityManager } from 'typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { BookingClientsService } from './booking-clients.service';

describe('BookingClientsService', () => {
  it('devuelve el mismo client_id para un POST repetido', async () => {
    let stored:
      | {
          id: string;
          name: string;
          email: string;
          identification: string;
          phone: string;
          license: string;
        }
      | undefined;
    const query = jest.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('SELECT id,name,email')) return stored ? [stored] : [];
      if (sql.includes('INSERT INTO booking_clients')) {
        stored = {
          id: String(values?.[0]),
          name: String(values?.[1]),
          email: String(values?.[2]),
          identification: String(values?.[3]),
          phone: String(values?.[4]),
          license: String(values?.[5]),
        };
        return [];
      }
      if (sql.includes('UPDATE booking_clients') && stored) {
        stored = {
          id: stored.id,
          name: String(values?.[1]),
          email: String(values?.[2]),
          identification: String(values?.[3]),
          phone: String(values?.[4]),
          license: String(values?.[5]),
        };
        return [];
      }
      return [];
    });
    const manager = { query } as unknown as EntityManager;
    const db = {
      transaction: (callback: (value: EntityManager) => unknown) =>
        callback(manager),
    } as unknown as DataSource;
    const service = new BookingClientsService(db);
    const body = {
      nombre: 'Nombre Apellido',
      email: 'CLIENTE@ejemplo.com',
      identificacion: '1712345678',
      telefono: '0999999999',
      licencia: 'LIC-123456',
    };
    const first = await service.create(body);
    const repeated = await service.create(body);
    expect(repeated.client_id).toBe(first.client_id);
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO booking_clients'),
      ),
    ).toHaveLength(1);
  });

  it('reutiliza un cliente registrado para asociarlo a una reserva', async () => {
    const stored = {
      id: '00000000-0000-4000-8000-000000000031',
      name: 'Cliente Booking',
      email: 'cliente@ejemplo.com',
      identification: 'identificacion-enmascarada',
      phone: '0990000000',
      license: 'licencia-enmascarada',
    };
    const query = jest.fn(async () => [stored]);
    const manager = { query } as unknown as EntityManager;
    const service = new BookingClientsService({} as DataSource);

    const client = await service.requireForDriver(manager, {
      email: 'CLIENTE@ejemplo.com',
      license_number: 'licencia-enmascarada',
    });

    expect(client.id).toBe(stored.id);
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'cliente@ejemplo.com',
      null,
      'licencia-enmascarada',
    ]);
  });

  it('rechaza crear una reserva si Booking no registró primero al cliente', async () => {
    const manager = {
      query: jest.fn(async () => []),
    } as unknown as EntityManager;
    const service = new BookingClientsService({} as DataSource);

    await expect(
      service.requireForDriver(manager, {
        email: 'sin-registro@ejemplo.com',
        license_number: 'licencia-sin-registro',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
