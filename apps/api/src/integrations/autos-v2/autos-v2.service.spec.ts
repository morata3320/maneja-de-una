import type { DataSource } from 'typeorm';
import { AutosV2Service } from './autos-v2.service';
import type { InventoryStockOutboxService } from '../inventory/inventory-stock-outbox.service';
import type { BookingClientsService } from '../booking/booking-clients.service';
import type { BookingCheckinService } from '../booking/booking-checkin.service';

describe('AutosV2Service reservation schedule', () => {
  it('returns Booking dropoff time and the projected availability after cooldown', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'order-1',
          locator: 'MDU-TEST',
          status: 'CONFIRMED',
          vehicle_id: 'vehicle-1',
          starts_at: new Date('2042-05-10T15:00:00.000Z'),
          ends_at: new Date('2042-05-12T15:00:00.000Z'),
          total_amount: '100',
          currency: 'USD',
        },
      ]),
    } as unknown as DataSource;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      {} as BookingCheckinService,
    );

    await expect(
      service.order('order-1', {
        id: 'booking',
        role: 'INTEGRATION',
        scopes: [],
      }),
    ).resolves.toMatchObject({
      pickup_date: '2042-05-10',
      pickup_time: '10:00',
      dropoff_date: '2042-05-12',
      dropoff_time: '10:00',
      disponible_desde: '2042-05-12T17:00:00.000Z',
    });
  });

  it('filters requested ranges only by semi-open reservation and real cooldown overlaps', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
      query,
    } as unknown as DataSource;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      {} as BookingCheckinService,
    );

    await service.search({
      pickup_location: 'Quito',
      pickup_date: '2042-10-01',
      pickup_time: '10:00',
      dropoff_date: '2042-10-04',
      dropoff_time: '10:00',
      driver_age: 30,
    });

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("o.status IN ('PENDING','CONFIRMED')");
    expect(sql).toContain('o.starts_at<$6 AND o.ends_at>$5');
    expect(sql).toContain('vc.starts_at<$6 AND vc.ends_at>$5');
    expect(sql).toContain(
      "$5::timestamptz IS NOT NULL OR v.operational_status<>'EN_LIMPIEZA'",
    );
  });

  it('reports RESERVADO only while a blocking reservation is currently active', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const vehicle = {
      id: 'vehicle-1',
      brand: 'Toyota',
      model: 'Corolla',
      category: 'COMPACTO',
      price_per_day: '50',
      transmission: 'AUTOMATIC',
      seats: 5,
      doors: 4,
      bag_capacity: 2,
      mileage: 100,
      next_maintenance_km: 10000,
      operational_status: 'DISPONIBLE',
    };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ ...vehicle, current_reservation: true }])
        .mockResolvedValueOnce([{ ...vehicle, current_reservation: false }]),
    } as unknown as DataSource;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      {} as BookingCheckinService,
    );

    const active = await service.catalog();
    const futureOnly = await service.catalog();

    expect(active.data[0]?.estado).toBe('RESERVADO');
    expect(futureOnly.data[0]?.estado).toBe('DISPONIBLE');
  });

  it('rejects retroactive searches before checking availability', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      {} as BookingCheckinService,
    );

    await expect(
      service.search({
        pickup_location: 'Quito',
        pickup_date: '2020-01-01',
        pickup_time: '10:00',
        dropoff_date: '2020-01-02',
        dropoff_time: '10:00',
        driver_age: 30,
      }),
    ).rejects.toThrow('No se permiten búsquedas retroactivas.');
  });
});
