import { InventoryRabbitMqClient } from './inventory-rabbitmq.client';
import type { StockUpdateMessage } from './inventory-stock.types';

const message: StockUpdateMessage = {
  service_id: 'NODE_AUT_MDU',
  item_id: 'TEST-VEHICLE',
  available_units: 0,
  date: '2026-10-30',
  time_slot: '00:00-23:59',
  timestamp: 1_798_755_200_000,
  slot_id: 'TEST-VEHICLE:2026-10-30',
};

describe('InventoryRabbitMqClient', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
    jest.restoreAllMocks();
  });

  it('publica el payload contractual, persistente, y espera publisher confirm', async () => {
    process.env.STOCK_SYNC_ENABLED = 'true';
    process.env.STOCK_SYNC_TRANSPORT = 'rabbitmq';
    process.env.RABBITMQ_URL = 'amqps://user:password@rabbit.example/vhost';
    const publish = jest.fn(
      (
        _exchange: string,
        _routingKey: string,
        _payload: Buffer,
        _options: unknown,
        callback: (error: Error | null) => void,
      ) => {
        callback(null);
        return true;
      },
    );
    const client = new InventoryRabbitMqClient();
    jest
      .spyOn(client as never, 'getChannel')
      .mockResolvedValue({ publish } as never);

    const ack = await client.push(message);

    expect(publish).toHaveBeenCalledWith(
      'booking.events',
      'stock.updated',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true, deliveryMode: 2 }),
      expect.any(Function),
    );
    const firstCall = publish.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = JSON.parse((firstCall![2] as Buffer).toString('utf8'));
    expect(payload).toEqual({
      service_id: 'NODE_AUT_MDU',
      item_id: 'TEST-VEHICLE',
      available_units: 0,
      date: '2026-10-30',
    });
    expect(ack).toMatchObject({ success: true, error_code: 'OK' });
  });

  it('propaga un nack del broker para que el Outbox reprograme el evento', async () => {
    process.env.STOCK_SYNC_ENABLED = 'true';
    process.env.STOCK_SYNC_TRANSPORT = 'rabbitmq';
    process.env.RABBITMQ_URL = 'amqps://user:password@rabbit.example/vhost';
    const client = new InventoryRabbitMqClient();
    jest.spyOn(client as never, 'getChannel').mockResolvedValue({
      publish: (
        _exchange: string,
        _routingKey: string,
        _payload: Buffer,
        _options: unknown,
        callback: (error: Error) => void,
      ) => callback(new Error('broker nack')),
    } as never);

    await expect(client.push(message)).rejects.toThrow('broker nack');
  });
});
