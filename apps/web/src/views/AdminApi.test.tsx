import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/apiClient';
import { AdminApiCollection, ReservationsAdmin } from './AdminApi';

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

describe('VehiclesAdmin dependent selectors', () => {
  it('filters models and depots, resets stale selections and submits a valid combination', async () => {
    const pages: Record<string, unknown[]> = {
      brands: [
        { id: 'brand-a', name: 'Marca A' },
        { id: 'brand-empty', name: 'Marca sin modelos' },
      ],
      'vehicle-models': [
        { id: 'model-a', brandId: 'brand-a', name: 'Modelo A' },
        { id: 'model-b', brandId: 'brand-b', name: 'Modelo B' },
      ],
      categories: [{ id: 'category-a', name: 'SUV' }],
      locations: [
        { id: 'location-a', name: 'Quito' },
        { id: 'location-b', name: 'Guayaquil' },
      ],
      suppliers: [
        { id: 1, name: 'Proveedor A' },
        { id: 2, name: 'Proveedor B' },
      ],
      depots: [
        {
          id: 11,
          supplierId: 1,
          locationId: 'location-a',
          name: 'Agencia A',
        },
        {
          id: 22,
          supplierId: 2,
          locationId: 'location-b',
          name: 'Agencia B',
        },
      ],
    };
    vi.mocked(api).mockImplementation(async ({ method, url, data }) => {
      if (method === 'POST' && url === '/vehicles')
        return { id: 'vehicle-created', ...data } as never;
      const resource = String(url).split('?')[0]?.slice(1) ?? '';
      if (resource === 'vehicles')
        return { data: [], total: 0, page: 1, limit: 10 } as never;
      if (resource in pages)
        return {
          data: pages[resource],
          total: pages[resource]?.length ?? 0,
        } as never;
      throw new Error(`Solicitud inesperada: ${String(url)}`);
    });
    const user = userEvent.setup();
    render(<AdminApiCollection resource="vehicles" title="Vehículos" />);
    await user.click(
      await screen.findByRole('button', { name: 'Nuevo registro' }),
    );

    const model = screen.getByLabelText('Modelo');
    const depot = screen.getByLabelText('Agencia');
    expect(model).toHaveProperty('disabled', true);
    expect(depot).toHaveProperty('disabled', true);

    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-a');
    expect(await screen.findByRole('option', { name: 'Modelo A' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Modelo B' })).toBeNull();
    await user.selectOptions(model, 'model-a');
    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-empty');
    expect(model).toHaveProperty('value', '');
    expect(
      screen.getByRole('option', { name: 'No hay opciones compatibles' }),
    ).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-a');
    await user.selectOptions(model, 'model-a');
    await user.selectOptions(screen.getByLabelText('Categoría'), 'category-a');
    await user.selectOptions(screen.getByLabelText('Proveedor'), '1');
    expect(await screen.findByRole('option', { name: 'Agencia A' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Agencia B' })).toBeNull();
    await user.selectOptions(depot, '11');
    expect(screen.getByLabelText('Ubicación')).toHaveProperty(
      'value',
      'location-a',
    );

    await user.type(screen.getByLabelText('Año'), '2026');
    await user.type(screen.getByLabelText('Color'), 'Blanco');
    await user.type(screen.getByLabelText('Placa'), 'AUD-1234');
    await user.selectOptions(screen.getByLabelText('Transmisión'), 'AUTOMATIC');
    await user.selectOptions(screen.getByLabelText('Combustible'), 'HYBRID');
    await user.type(screen.getByLabelText('Asientos'), '5');
    await user.type(screen.getByLabelText('Puertas'), '4');
    await user.type(screen.getByLabelText('Maletas'), '2');
    await user.type(screen.getByLabelText('Precio por día'), '50');
    await user.type(screen.getByLabelText('Kilometraje'), '0');
    await user.type(screen.getByLabelText('Cantidad / Stock'), '1');
    await user.type(screen.getByLabelText('Descripción'), 'Prueba controlada');
    await user.selectOptions(screen.getByLabelText('Estado'), 'AVAILABLE');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/vehicles',
        data: expect.objectContaining({
          brandId: 'brand-a',
          modelId: 'model-a',
          supplierId: '1',
          depotId: '11',
          locationId: 'location-a',
        }),
      }),
    );
  });
});
