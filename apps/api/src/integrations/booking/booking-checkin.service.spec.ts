import type { DataSource, EntityManager } from 'typeorm';
import type { BookingCheckinClient } from './booking-checkin.client';
import { BookingCheckinService } from './booking-checkin.service';
import type { BookingClientsService } from './booking-clients.service';

const notification = {
  order_id: '00000000-0000-4000-8000-000000000001',
  client_id: '00000000-0000-4000-8000-000000000002',
  external_order_id: '00000000-0000-4000-8000-000000000001',
  admin_id: 'operador-mostrador',
  checkin_at: '2026-11-04T19:30:00.000Z',
  observations: 'Entrega física confirmada',
  status: 'SENDING' as const,
  attempts: 1,
  response_payload: null,
};

describe('BookingCheckinService', () => {
  it('confirma el Outbox únicamente después del ACK de Booking', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([notification])
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
  });

  it('preserva PENDING con backoff cuando Booking falla', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([notification])
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
});
