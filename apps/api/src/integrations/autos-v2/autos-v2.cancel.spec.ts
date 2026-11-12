import type { DataSource } from 'typeorm';
import type { BookingCheckinService } from '../booking/booking-checkin.service';
import type { BookingClientsService } from '../booking/booking-clients.service';
import type { InventoryStockOutboxService } from '../inventory/inventory-stock-outbox.service';
import { AutosV2Service } from './autos-v2.service';

const now = new Date('2026-11-10T15:00:00.000Z');
const actor = {
  id: 'booking-api-key',
  role: 'INTEGRATION',
  scopes: [],
} as const;

type OrderOverrides = Partial<Record<string, unknown>>;

function setup(overrides: OrderOverrides = {}, overlapping = false) {
  const order: Record<string, unknown> = {
    id: '10000000-0000-4000-8000-000000000001',
    locator: 'MDU-CANCEL1',
    status: 'CONFIRMED',
    vehicle_id: '20000000-0000-4000-8000-000000000001',
    owner_id: actor.id,
    starts_at: new Date('2026-11-12T15:00:00.000Z'),
    ends_at: new Date('2026-11-13T15:00:00.000Z'),
    total_amount: '150.00',
    currency: 'USD',
    digital_checkin_at: null,
    delivered_at: null,
    returned_at: null,
    refund_reference: null,
    ...overrides,
  };
  const updated = { ...order, status: 'CANCELLED' };
  const query = jest.fn(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM orders')) return [order];
    if (sql.startsWith('UPDATE orders SET status')) return [updated];
    if (sql.startsWith('SELECT operational_status'))
      return [{ operational_status: 'DISPONIBLE', active: true }];
    if (sql.startsWith('SELECT id FROM orders WHERE vehicle_id'))
      return overlapping ? [{ id: 'other-order' }] : [];
    if (sql.startsWith('SELECT id FROM vehicle_cooldowns')) return [];
    return [];
  });
  const manager = { query };
  const db = {
    transaction: jest.fn(
      async (callback: (value: typeof manager) => Promise<unknown>) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const service = new AutosV2Service(
    db,
    { enqueue } as unknown as InventoryStockOutboxService,
    {} as BookingClientsService,
    {} as BookingCheckinService,
  );
  return { service, enqueue, query, order };
}

describe('AutosV2Service cancellation Saga', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it.each([
    ['48 hours before pickup', '2026-11-12T15:00:00.000Z'],
    ['exactly 24 hours before pickup', '2026-11-11T15:00:00.000Z'],
  ])('allows cancellation %s and returns a full stable refund', async (_, startsAt) => {
    const { service, enqueue } = setup({ starts_at: new Date(startsAt) });

    const result = await service.cancel(
      'MDU-CANCEL1',
      actor,
      'correlation-1',
      'Cambio de itinerario',
    );

    expect(result).toMatchObject({
      order_id: '10000000-0000-4000-8000-000000000001',
      pnr: 'MDU-CANCEL1',
      status: 'CANCELLED',
      auto_id: '20000000-0000-4000-8000-000000000001',
      refund: {
        amount: 150,
        currency: 'USD',
        percentage: 100,
        status: 'PROCESSED',
      },
      inventory_restoration: {
        status: 'RESTORED',
        new_state: 'DISPONIBLE',
      },
    });
    expect(result.refund.refund_id).toMatch(/^REF-AUTO-[A-F0-9]{6}$/);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.anything(),
      '20000000-0000-4000-8000-000000000001',
      expect.any(Date),
      1,
      'correlation-1',
    );
  });

  it.each([
    ['23 hours 59 minutes before pickup', '2026-11-11T14:59:00.000Z'],
    ['after pickup', '2026-11-10T14:59:00.000Z'],
  ])('rejects cancellation %s', async (_, startsAt) => {
    const { service, enqueue } = setup({ starts_at: new Date(startsAt) });

    await expect(
      service.cancel('MDU-CANCEL1', actor, 'correlation-1'),
    ).rejects.toMatchObject({
      response: {
        title: 'Cancelación Fuera de Plazo',
        status: 409,
        code: 'CANCELLATION_DEADLINE_EXPIRED',
      },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['ENTREGADO', { delivered_at: new Date('2026-11-10T14:00:00.000Z') }],
    ['CHECKED_IN', { digital_checkin_at: new Date('2026-11-10T14:00:00.000Z') }],
    ['COMPLETED', { status: 'COMPLETED' }],
  ])('rejects an order in state %s', async (_, overrides) => {
    const { service, enqueue } = setup(overrides);

    await expect(
      service.cancel('MDU-CANCEL1', actor, 'correlation-1'),
    ).rejects.toMatchObject({
      response: {
        title: 'Cancelación No Permitida',
        status: 409,
        code: 'CANCELLATION_NOT_ALLOWED',
      },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns the original refund for an already-cancelled order without duplicating effects', async () => {
    const { service, enqueue, query } = setup({
      status: 'CANCELLED',
      starts_at: new Date('2026-11-09T15:00:00.000Z'),
      refund_reference: 'REF-AUTO-ABC123',
    });

    const result = await service.cancel(
      'MDU-CANCEL1',
      actor,
      'correlation-2',
    );

    expect(result.refund.refund_id).toBe('REF-AUTO-ABC123');
    expect(enqueue).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).startsWith('UPDATE orders SET status'),
      ),
    ).toBe(false);
  });

  it('does not report restored stock when another reservation overlaps', async () => {
    const { service, enqueue } = setup({}, true);

    const result = await service.cancel(
      'MDU-CANCEL1',
      actor,
      'correlation-3',
    );

    expect(result.inventory_restoration).toMatchObject({
      status: 'PRESERVED',
      new_state: 'RESERVADO',
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(Date),
      0,
      'correlation-3',
    );
  });

  it('does not add refund behavior to an early vehicle return', async () => {
    const { service } = setup();
    expect(service.returnOrder.toString()).not.toContain('refund_reference');
  });
});
