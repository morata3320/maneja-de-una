import { BookingCheckinClient } from './booking-checkin.client';

const originalEnv = process.env;
const payload = {
  booking_code: 'MDU-ORDER1',
  staff_user: 'operador-mostrador',
  fecha_checkin: '2026-11-04T19:30:00.000Z',
  licencia_conducir: 'LIC-123456',
  km_salida: 42000,
  documento_identidad: '1712345678',
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
        'https://booking-core-api.azurewebsites.net/api/v3/reservas/MDU-ORDER1/checkin',
      ),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'booking-checkin-secret',
          'Idempotency-Key': 'mdu-checkin-MDU-ORDER1',
        }),
        body: JSON.stringify({
          staff_user: 'operador-mostrador',
          fecha_checkin: '2026-11-04T19:30:00.000Z',
        }),
      }),
    );
  });

  it.each(['checkin', 'checkin-entrega'] as const)(
    'soporta el endpoint V1 %s sin enviar a V3 en paralelo',
    async (action) => {
      process.env.BOOKING_CHECKIN_ENDPOINT_VERSION = 'v1';
      process.env.BOOKING_CHECKIN_V1_ACTION = action;
      delete process.env.BOOKING_CHECKIN_BASE_URL;
      const response = {
        acknowledged: true,
        status: 'CONFIRMADO_ASISTIDO',
        voucher: { id: 'VCH-1', verified: true },
      };
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(
        new BookingCheckinClient().notify(payload, 'correlation-v1'),
      ).resolves.toEqual(response);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toEqual(
        new URL(
          `https://booking-core-api.azurewebsites.net/api/v1/autos/orders/MDU-ORDER1/${action}`,
        ),
      );
      expect(fetchMock.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({
          body: JSON.stringify(
            action === 'checkin-entrega'
              ? { licencia_conducir: 'LIC-123456', km_salida: 42000 }
              : { documento_identidad: '1712345678' },
          ),
        }),
      );
    },
  );

  it.each([404, 500])('reporta el HTTP %s de Booking', async (status) => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status }));
    await expect(
      new BookingCheckinClient().notify(payload, 'correlation-http'),
    ).rejects.toThrow(`BOOKING_CHECKIN_HTTP_${status}`);
  });

  it('propaga un timeout sin inventar un ACK', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    await expect(
      new BookingCheckinClient().notify(payload, 'correlation-timeout'),
    ).rejects.toThrow('Timeout');
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
