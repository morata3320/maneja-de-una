import type { DataSource, EntityManager } from 'typeorm';
import type { BookingCheckinClient } from './booking-checkin.client';
import { BookingCheckinService } from './booking-checkin.service';
import type { BookingClientsService } from './booking-clients.service';

const notification = {
  order_id: '00000000-0000-4000-8000-000000000001',
  client_id: '00000000-0000-4000-8000-000000000002',
  external_order_id: 'MDU-TEST',
  admin_id: 'operador-mostrador',
  checkin_at: '2026-11-04T19:30:00.000Z',
  observations: 'Entrega física confirmada',
  status: 'SENDING' as const,
  attempts: 1,
  response_payload: null,
  license: 'LIC-123456',
  initial_mileage: 42000,
  identification: '1712345678',
};

describe('BookingCheckinService', () => {
  it('usa parámetros separados para order_id UUID y external_order_id text', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new BookingCheckinService(
      {} as DataSource,
      {} as BookingClientsService,
      {} as BookingCheckinClient,
    );

    await expect(
      service.prepare(
        { query } as unknown as EntityManager,
        {
          id: notification.order_id,
          locator: 'MDU-TEST',
          client_id: notification.client_id,
          driver_details: {},
        },
        notification.admin_id,
        notification.observations,
      ),
    ).resolves.toBe(notification.client_id);

    expect(query.mock.calls[0][0]).toContain('VALUES($1,$2,$6,$3,$4,$5)');
    expect(query.mock.calls[0][1]).toHaveLength(6);
    expect(query.mock.calls[0][1][5]).toBe('MDU-TEST');
  });

  it('confirma el Outbox únicamente después del ACK de Booking', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[notification], 1])
      .mockResolvedValueOnce([]);
    const db = {
      transaction: (callback: (manager: EntityManager) => unknown) =>
        callback({ query } as unknown as EntityManager),
      query,
    } as unknown as DataSource;
    const client = {
      notify: jest.fn().mockResolvedValue({
        acknowledged: true,
        status: 'CONFIRMADO_ASISTIDO',
      }),
    } as unknown as BookingCheckinClient;
    const service = new BookingCheckinService(
      db,
      {} as BookingClientsService,
      client,
    );
    await expect(
      service.notify(notification.order_id, 'corr'),
    ).resolves.toEqual({
      acknowledged: true,
      status: 'CONFIRMADO_ASISTIDO',
      attempts: 1,
    });
    expect(query.mock.calls[1][0]).toContain("status='ACKNOWLEDGED'");
    expect(client.notify).toHaveBeenCalledWith(
      {
        booking_code: 'MDU-TEST',
        staff_user: 'operador-mostrador',
        fecha_checkin: '2026-11-04T19:30:00.000Z',
        licencia_conducir: 'LIC-123456',
        km_salida: 42000,
        documento_identidad: '1712345678',
      },
      'corr',
    );
  });

  it('conserva el voucher real dentro de response_payload', async () => {
    const ack = {
      acknowledged: true as const,
      status: 'CONFIRMADO_ASISTIDO' as const,
      voucher: { id: 'VCH-BOOKING-1', verified: true },
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([[notification], 1])
      .mockResolvedValueOnce([]);
    const db = {
      transaction: (callback: (manager: EntityManager) => unknown) =>
        callback({ query } as unknown as EntityManager),
      query,
    } as unknown as DataSource;
    const client = {
      notify: jest.fn().mockResolvedValue(ack),
    } as unknown as BookingCheckinClient;
    const service = new BookingCheckinService(
      db,
      {} as BookingClientsService,
      client,
    );

    await expect(
      service.notify(notification.order_id, 'corr'),
    ).resolves.toEqual({
      ...ack,
      attempts: 1,
    });
    expect(query.mock.calls[1]?.[1]).toEqual([notification.order_id, ack]);
  });

  it('preserva PENDING con backoff cuando Booking falla', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[notification], 1])
      .mockResolvedValueOnce([]);
    const db = {
      transaction: (callback: (manager: EntityManager) => unknown) =>
        callback({ query } as unknown as EntityManager),
      query,
    } as unknown as DataSource;
    const client = {
      notify: jest
        .fn()
        .mockRejectedValue(new Error('BOOKING_CHECKIN_HTTP_503')),
    } as unknown as BookingCheckinClient;
    const service = new BookingCheckinService(
      db,
      {} as BookingClientsService,
      client,
    );
    await expect(
      service.notify(notification.order_id, 'corr'),
    ).resolves.toMatchObject({
      acknowledged: false,
      status: 'PENDING',
      error: 'BOOKING_CHECKIN_HTTP_503',
    });
    expect(query.mock.calls[1][0]).toContain("status='PENDING'");
  });

  it('no repite una notificación que ya fue confirmada', async () => {
    const acknowledged = {
      ...notification,
      status: 'ACKNOWLEDGED' as const,
      attempts: 2,
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([[], 0])
      .mockResolvedValueOnce([acknowledged]);
    const db = {
      transaction: (callback: (manager: EntityManager) => unknown) =>
        callback({ query } as unknown as EntityManager),
      query,
    } as unknown as DataSource;
    const client = { notify: jest.fn() } as unknown as BookingCheckinClient;
    const service = new BookingCheckinService(
      db,
      {} as BookingClientsService,
      client,
    );

    await expect(
      service.notify(notification.order_id, 'corr'),
    ).resolves.toEqual({
      acknowledged: true,
      status: 'CONFIRMADO_ASISTIDO',
      attempts: 2,
    });
    expect(client.notify).not.toHaveBeenCalled();
  });
});
