import { BookingCheckinClient } from './booking-checkin.client';

const originalEnv = process.env;
const payload = {
  external_order_id: 'order-1',
  client_id: 'client-1',
  estado: 'CONFIRMADO_ASISTIDO' as const,
  admin_id: 'operador-mostrador',
  fecha_checkin: '2026-11-04T19:30:00.000Z',
  observaciones: 'Entrega física confirmada',
};

describe('BookingCheckinClient', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      BOOKING_CHECKIN_ENABLED: 'true',
      BOOKING_CHECKIN_API_KEY: 'booking-checkin-secret',
      BOOKING_CHECKIN_BASE_URL:
        'https://booking-core-api.azurewebsites.net/api/v3',
    };
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('envía X-API-Key e Idempotency-Key y exige acknowledged=true', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          acknowledged: true,
          status: 'CONFIRMADO_ASISTIDO',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await expect(
      new BookingCheckinClient().notify(payload, 'correlation-1'),
    ).resolves.toEqual({
      acknowledged: true,
      status: 'CONFIRMADO_ASISTIDO',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://booking-core-api.azurewebsites.net/api/v3/reservas/order-1/checkin',
      ),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'booking-checkin-secret',
          'Idempotency-Key': 'mdu-checkin-order-1',
        }),
      }),
    );
  });

  it('rechaza un HTTP 200 sin ACK contractual', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      new BookingCheckinClient().notify(payload, 'correlation-2'),
    ).rejects.toThrow('BOOKING_CHECKIN_INVALID_ACK');
  });
});
