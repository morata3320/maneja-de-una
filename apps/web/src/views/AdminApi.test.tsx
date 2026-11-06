import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/apiClient';
import { ReservationsAdmin } from './AdminApi';

vi.mock('../services/apiClient', () => ({ api: vi.fn() }));

const incompleteReservation = {
  id: '4ac7859d-81ec-4f07-b480-cff334fb7055',
  locator: 'MDU-AUDIT',
  status: 'CONFIRMED',
  createdAt: '2026-11-06T14:43:59.000Z',
};

describe('ReservationsAdmin delivery check-in', () => {
  beforeEach(() => {
    vi.mocked(api).mockImplementation(async ({ url }) => {
      if (String(url).startsWith('/reservations?')) {
        return {
          data: [incompleteReservation],
          total: 1,
          page: 1,
          limit: 10,
        } as never;
      }
      if (url === `/reservations/${incompleteReservation.id}`) {
        return incompleteReservation as never;
      }
      throw new Error(`Solicitud inesperada: ${String(url)}`);
    });
  });

  it('abre el formulario aunque la fila no incluya los datos de entrega', async () => {
    const user = userEvent.setup();
    render(<ReservationsAdmin />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Confirmar Entrega de Llaves / Check-in',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Confirmar entrega de llaves / Check-in',
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Licencia de conducir')).toBeTruthy();
    expect(screen.getByLabelText('Kilometraje de salida')).toBeTruthy();
    expect(screen.getByLabelText('Operador responsable')).toBeTruthy();
    expect(screen.getByLabelText('Observaciones')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'no tiene un cliente Booking',
    );
  });

  it('abre el formulario de devolución para una reserva entregada', async () => {
    const delivered = {
      ...incompleteReservation,
      deliveredAt: '2026-11-06T17:00:00.000Z',
      initialMileage: 32000,
      vehicleMileage: 32000,
    };
    vi.mocked(api).mockImplementation(async ({ url }) => {
      if (String(url).startsWith('/reservations?'))
        return { data: [delivered], total: 1, page: 1, limit: 10 } as never;
      if (url === `/reservations/${delivered.id}`) return delivered as never;
      throw new Error(`Solicitud inesperada: ${String(url)}`);
    });
    const user = userEvent.setup();
    render(<ReservationsAdmin />);

    await user.click(
      await screen.findByRole('button', { name: 'Devolver vehículo' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Registrar devolución del vehículo',
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Kilometraje de retorno')).toBeTruthy();
    expect(screen.getByLabelText('Nivel de combustible (%)')).toBeTruthy();
  });
});
