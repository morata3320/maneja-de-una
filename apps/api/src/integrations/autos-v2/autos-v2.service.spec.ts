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
    expect(sql).toContain("o.status='PENDING' AND o.ends_at>$5");
    expect(sql).toContain("o.status='CONFIRMED'");
    expect(sql).toContain('o.returned_at IS NULL');
    expect(sql).toContain('GREATEST(o.ends_at,o.returned_at)>$5');
    expect(sql).toContain('o.starts_at<$6');
    expect(sql).toContain('vc.starts_at<$6 AND vc.ends_at>$5');
    expect(sql).toContain(
      "$5::timestamptz IS NOT NULL OR v.operational_status<>'EN_LIMPIEZA'",
    );
  });

  it('keeps confirmed units blocked after the planned end until physical return', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    };
    const db = {} as DataSource;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      {} as BookingCheckinService,
    );
    const ensureAvailable = (
      service as unknown as {
        ensureAvailable: (
          m: typeof manager,
          vehicle: {
            id: string;
            operational_status: string;
          },
          start: Date,
          end: Date,
        ) => Promise<void>;
      }
    ).ensureAvailable.bind(service);
    const start = new Date('2026-11-28T15:00:00.000Z');
    const end = new Date('2026-11-29T15:00:00.000Z');

    await ensureAvailable(
      manager,
      { id: 'vehicle-1', operational_status: 'DISPONIBLE' },
      start,
      end,
    );

    const orderSql = String(manager.query.mock.calls[1]?.[0]);
    expect(orderSql).toContain("status='PENDING' AND ends_at>$2");
    expect(orderSql).toContain("status='CONFIRMED'");
    expect(orderSql).toContain('returned_at IS NULL');
    expect(orderSql).toContain('GREATEST(ends_at,returned_at)>$2');
    expect(manager.query.mock.calls[1]?.[1]).toEqual([
      'vehicle-1',
      start,
      end,
    ]);
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

describe('AutosV2Service delivery safeguards', () => {
  const actor = {
    id: 'admin-1',
    role: 'ADMIN' as const,
    scopes: ['autos:admin'],
  };

  it('bloquea la entrega de una reserva cancelada', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 'order-1',
          locator: 'MDU-CANCELLED',
          status: 'CANCELLED',
          digital_checkin_at: new Date(),
        },
      ]),
    };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const bookingCheckin = {
      notify: jest.fn(),
      prepare: jest.fn(),
    } as unknown as BookingCheckinService;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      bookingCheckin,
    );

    await expect(
      service.delivery(
        'order-1',
        { licencia_conducir: 'LIC-1', km_salida: 100 },
        actor,
        'corr',
      ),
    ).rejects.toThrow('Reserva no confirmada.');
    expect(bookingCheckin.prepare).not.toHaveBeenCalled();
    expect(bookingCheckin.notify).not.toHaveBeenCalled();
  });

  it('bloquea una segunda entrega cuando el vehículo sigue entregado', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'order-2',
            locator: 'MDU-CONFIRMED',
            status: 'CONFIRMED',
            vehicle_id: 'vehicle-1',
            digital_checkin_at: new Date(),
            delivered_at: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            mileage: 100,
            operational_status: 'ENTREGADO',
            active_delivery: true,
          },
        ]),
    };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const bookingCheckin = {
      notify: jest.fn(),
      prepare: jest.fn(),
    } as unknown as BookingCheckinService;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      bookingCheckin,
    );

    await expect(
      service.delivery(
        'order-2',
        { licencia_conducir: 'LIC-1', km_salida: 100 },
        actor,
        'corr',
      ),
    ).rejects.toThrow('El vehículo ya tiene una entrega activa');
    expect(bookingCheckin.prepare).not.toHaveBeenCalled();
  });

  it('reintenta solo la notificación de una entrega ya registrada', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 'order-3',
          locator: 'MDU-RETRY',
          status: 'CONFIRMED',
          delivered_at: new Date('2026-11-12T15:00:00.000Z'),
        },
      ]),
    };
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const bookingCheckin = {
      notify: jest.fn().mockResolvedValue({
        acknowledged: true,
        status: 'CONFIRMADO_ASISTIDO',
        attempts: 2,
      }),
    } as unknown as BookingCheckinService;
    const service = new AutosV2Service(
      db,
      {} as InventoryStockOutboxService,
      {} as BookingClientsService,
      bookingCheckin,
    );

    await expect(
      service.retryDeliveryNotification('order-3', actor, 'corr-retry'),
    ).resolves.toMatchObject({
      order_id: 'order-3',
      pnr: 'MDU-RETRY',
      estado_orden: 'ENTREGADO',
      booking_notification: { acknowledged: true },
    });
    expect(bookingCheckin.notify).toHaveBeenCalledTimes(1);
    expect(bookingCheckin.notify).toHaveBeenCalledWith(
      'order-3',
      'corr-retry',
    );
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
