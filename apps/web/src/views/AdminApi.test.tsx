import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('Identificación y clasificación')).toBeTruthy();
    expect(screen.getByText('Ubicación y operación')).toBeTruthy();
    expect(screen.getByText('Características técnicas')).toBeTruthy();
    expect(screen.getByText('Tarifa e inventario')).toBeTruthy();
    expect(screen.getByLabelText('Placa').getAttribute('placeholder')).toBe(
      'PBA-1234',
    );
    expect(
      screen.getByLabelText('Precio por día').getAttribute('placeholder'),
    ).toBe('45.00');
    expect(
      screen.getByText('Las opciones dependen de la marca seleccionada.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Las agencias dependen del proveedor seleccionado.'),
    ).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-a');
    expect(
      await screen.findByRole('option', { name: 'Modelo A' }),
    ).toBeTruthy();
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
    expect(
      await screen.findByRole('option', { name: 'Agencia A' }),
    ).toBeTruthy();
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
        data: {
          brandId: 'brand-a',
          modelId: 'model-a',
          categoryId: 'category-a',
          supplierId: '1',
          depotId: '11',
          locationId: 'location-a',
          year: 2026,
          color: 'Blanco',
          licensePlate: 'AUD-1234',
          transmission: 'AUTOMATIC',
          fuelType: 'HYBRID',
          seats: 5,
          doors: 4,
          bagCapacity: 2,
          pricePerDay: 50,
          mileage: 0,
          quantity: 1,
          description: 'Prueba controlada',
          status: 'AVAILABLE',
          active: true,
        },
      }),
    );
  });

  it('creates and selects brands and models through the existing admin endpoints', async () => {
    const pages: Record<string, Array<Record<string, unknown>>> = {
      brands: [{ id: 'brand-a', name: 'Marca A', active: true }],
      'vehicle-models': [
        { id: 'model-a', brandId: 'brand-a', name: 'Modelo A', active: true },
      ],
      categories: [{ id: 'category-a', name: 'SUV' }],
      locations: [{ id: 'location-a', name: 'Quito' }],
      suppliers: [{ id: 1, name: 'Proveedor A' }],
      depots: [],
    };
    vi.mocked(api).mockImplementation(async ({ method, url, data }) => {
      if (method === 'POST' && url === '/brands') {
        const created = { id: 'brand-new', ...data };
        pages.brands.push(created);
        return created as never;
      }
      if (method === 'POST' && url === '/vehicle-models') {
        const created = { id: 'model-new', ...data };
        pages['vehicle-models'].push(created);
        return created as never;
      }
      const resource = String(url).split('?')[0]?.slice(1) ?? '';
      if (resource === 'vehicles')
        return { data: [], total: 0, page: 1, limit: 10 } as never;
      if (resource in pages)
        return {
          data: pages[resource],
          total: pages[resource].length,
        } as never;
      throw new Error(`Solicitud inesperada: ${String(url)}`);
    });
    const user = userEvent.setup();
    render(<AdminApiCollection resource="vehicles" title="Vehículos" />);
    await user.click(
      await screen.findByRole('button', { name: 'Nuevo registro' }),
    );

    await user.click(screen.getByRole('button', { name: '+ Nuevo modelo' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Selecciona una marca',
    );

    await user.click(screen.getByRole('button', { name: '+ Nueva marca' }));
    let dialog = screen.getByRole('dialog', { name: 'Nueva marca' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog).getByRole('alert').textContent).toContain(
      'obligatorio',
    );
    const brandName = within(dialog).getByLabelText('Nombre de la marca');
    await user.type(brandName, 'Marca A');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Ya existe',
    );
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/brands' }),
    );

    await user.clear(brandName);
    await user.type(brandName, 'Marca Nueva');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Marca “Marca Nueva” creada y seleccionada.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Marca')).toHaveProperty('value', 'brand-new');
    expect(api).toHaveBeenCalledWith({
      method: 'POST',
      url: '/brands',
      data: { name: 'Marca Nueva', active: true },
    });

    await user.click(screen.getByRole('button', { name: '+ Nuevo modelo' }));
    dialog = screen.getByRole('dialog', { name: 'Nuevo modelo' });
    await user.type(
      within(dialog).getByLabelText('Nombre del modelo'),
      'Modelo Nuevo',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Modelo “Modelo Nuevo” creado y seleccionado.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Modelo')).toHaveProperty(
      'value',
      'model-new',
    );
    expect(api).toHaveBeenCalledWith({
      method: 'POST',
      url: '/vehicle-models',
      data: { name: 'Modelo Nuevo', brandId: 'brand-new', active: true },
    });
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/categories' }),
    );
  });
});
