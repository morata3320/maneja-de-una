import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reservation } from '../models';
import { api } from '../services/apiClient';
import { cancellationEligibility, MyReservations } from './MyReservations';

vi.mock('../services/apiClient', () => ({ api: vi.fn() }));

const now = new Date('2026-11-10T15:00:00.000Z');
const reservation: Reservation = {
  id: '10000000-0000-4000-8000-000000000001',
  vehicleId: '20000000-0000-4000-8000-000000000001',
  startsAt: '2026-11-12T15:00:00.000Z',
  endsAt: '2026-11-13T15:00:00.000Z',
  totalAmount: 150,
  currency: 'USD',
  status: 'CONFIRMED',
  createdAt: '2026-11-01T15:00:00.000Z',
  vehicle: {
    id: '20000000-0000-4000-8000-000000000001',
    brand: 'Toyota',
    model: 'RAV4',
    name: 'Toyota RAV4',
  },
  customer: null,
  payment: null,
  pickupDepot: null,
  pickupLocation: 'Quito',
};

describe('MyReservations cancellation policy', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }).setSystemTime(now));
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(api).mockReset();
  });

  it('uses the exact 24-hour boundary', () => {
    expect(
      cancellationEligibility(
        { ...reservation, startsAt: '2026-11-11T15:00:00.000Z' },
        now.getTime(),
      ),
    ).toBe('ALLOWED');
    expect(
      cancellationEligibility(
        { ...reservation, startsAt: '2026-11-11T14:59:00.000Z' },
        now.getTime(),
      ),
    ).toBe('DEADLINE_EXPIRED');
    expect(
      cancellationEligibility(
        { ...reservation, deliveredAt: '2026-11-10T14:00:00.000Z' },
        now.getTime(),
      ),
    ).toBe('IN_PROGRESS');
    expect(
      cancellationEligibility(
        { ...reservation, status: 'CANCELLED' },
        now.getTime(),
      ),
    ).toBe('UNAVAILABLE');
  });

  it('opens confirmation, calls V3 and displays the real refund result', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ data: [reservation] } as never)
      .mockResolvedValueOnce({
        order_id: reservation.id,
        pnr: 'MDU-CANCEL1',
        status: 'CANCELLED',
        refund: {
          refund_id: 'REF-AUTO-ABC123',
          amount: 150,
          currency: 'USD',
          percentage: 100,
          status: 'PROCESSED',
        },
        inventory_restoration: {
          status: 'RESTORED',
          new_state: 'DISPONIBLE',
          message: 'Vehículo reincorporado.',
        },
      } as never)
      .mockResolvedValueOnce({
        data: [{ ...reservation, status: 'CANCELLED' }],
      } as never);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MyReservations />);

    await user.click(await screen.findByRole('button', { name: 'Cancelar renta' }));
    expect(
      screen.getByRole('heading', { name: 'Confirmar cancelación de renta' }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: '¡Cancelación y Reembolso Exitosos!',
      }),
    ).toBeTruthy();
    expect(screen.getByText('REF-AUTO-ABC123')).toBeTruthy();
    expect(screen.getAllByText(/\$150\.00 USD/).length).toBeGreaterThan(0);
    expect(screen.getByText(/RESTORED/)).toBeTruthy();
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining(
          `/api/v3/autos/orders/${reservation.id}/cancel`,
        ),
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
          'X-Correlation-Id': expect.any(String),
        }),
      }),
    );
  });

  it('shows the backend 409 message without closing the modal', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ data: [reservation] } as never)
      .mockRejectedValueOnce(
        new Error(
          'La cancelación y reembolso solo están permitidos con al menos 24 horas de anticipación a la fecha y hora de recogida.',
        ),
      );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MyReservations />);

    await user.click(await screen.findByRole('button', { name: 'Cancelar renta' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'al menos 24 horas',
      ),
    );
    expect(
      screen.getByRole('heading', { name: 'Confirmar cancelación de renta' }),
    ).toBeTruthy();
  });
});
