import { InventoryRestClient } from './inventory-rest.client';

const originalEnv = process.env;

describe('InventoryRestClient', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STOCK_SYNC_ENABLED: 'true',
      STOCK_SYNC_TRANSPORT: 'rest',
      BOOKING_STOCK_URL:
        'https://booking-core-api.azurewebsites.net/api/v3/inventory/stock',
      BOOKING_STOCK_API_KEY: 'booking-central-test-key',
    };
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('publica el mensaje y exige un ACK contractual', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'accepted',
          processed_at: 1_793_112_300_100,
          error_code: 'OK',
          current_available: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      new InventoryRestClient().push({
        service_id: 'NODE_AUT_MDU',
        item_id: 'vehicle-1',
        date: '2044-07-10',
        time_slot: '10:00',
        available_units: 0,
        timestamp: 1_793_112_300_000,
        slot_id: 'slot-20440710-1000',
      }),
    ).resolves.toMatchObject({ success: true, error_code: 'OK' });
    expect(fetchMock).toHaveBeenCalledWith(
      process.env.BOOKING_STOCK_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': process.env.BOOKING_STOCK_API_KEY,
        }),
      }),
    );
  });

  it('no confirma respuestas sin ACK contractual', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      new InventoryRestClient().push({
        service_id: 'NODE_AUT_MDU',
        item_id: 'vehicle-1',
        date: '2044-07-10',
        time_slot: '10:00',
        available_units: 1,
        timestamp: 1,
        slot_id: 'slot-20440710-1000',
      }),
    ).rejects.toThrow('INVALID_BOOKING_REST_ACK');
  });
});
