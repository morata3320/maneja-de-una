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
});
