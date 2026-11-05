import type { DataSource, EntityManager } from 'typeorm';
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
});
