import type { DataSource, EntityManager } from 'typeorm';
import type { InventoryGrpcClient } from './inventory-grpc.client';
import { InventoryStockRelayService } from './inventory-stock-relay.service';
import type { PendingStockUpdate } from './inventory-stock.types';

const pending = (): PendingStockUpdate => ({
  id: '366d2ce6-7ed3-4a46-88fd-5b201f834496',
  service_id: 'maneja-de-una',
  item_id: '10000000-0000-4000-8000-000000000001',
  date: '2044-07-10',
  time_slot: '10:00',
  available_units: 0,
  timestamp: 1_793_112_300_000,
  slot_id: 'slot-20440710-1000',
  attempts: 0,
});

function harness(push: jest.Mock) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([pending()])
    .mockResolvedValueOnce([]);
  const manager = { query } as unknown as EntityManager;
  const db = {
    transaction: jest.fn(
      async (work: (value: EntityManager) => Promise<void>) => work(manager),
    ),
  } as unknown as DataSource;
  const grpc = {
    isEnabled: () => true,
    push,
  } as unknown as InventoryGrpcClient;
  return { service: new InventoryStockRelayService(db, grpc), query };
}

describe('InventoryStockRelayService', () => {
  it('marca la fila únicamente después de un ACK OK', async () => {
    const push = jest.fn().mockResolvedValue({
      success: true,
      message: 'accepted',
      processed_at: 1_793_112_300_100,
      error_code: 'OK',
      current_available: 0,
    });
    const { service, query } = harness(push);

    await service.flush();

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ available_units: 0 }),
    );
    expect(query.mock.calls[1][0]).toContain('acknowledged_at=now()');
  });

  it('conserva la fila y programa backoff cuando falla la entrega', async () => {
    const push = jest.fn().mockRejectedValue(new Error('Booking unavailable'));
    const { service, query } = harness(push);

    await service.flush();

    expect(query.mock.calls[1][0]).toContain('attempts=$2');
    expect(query.mock.calls[1][1]).toEqual([
      pending().id,
      1,
      2,
      'Booking unavailable',
    ]);
  });
});
