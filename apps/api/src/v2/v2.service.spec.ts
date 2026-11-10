import type { DataSource } from 'typeorm';
import type { VehicleDto } from './dto';
import { V2Service } from './v2.service';

describe('V2Service admin catalogs and vehicles', () => {
  beforeAll(() => {
    process.env.INTERNAL_JWT_SECRET = 'test-secret-with-at-least-32-characters';
  });

  describe('deleteUser', () => {
    it('returns a controlled conflict when PostgreSQL reports associated records', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([
          { id: '10000000-0000-4000-8000-000000000001', role: 'USER' },
        ])
        .mockRejectedValueOnce({
          code: '23503',
          constraint: 'payments_user_id_fkey',
        });
      const service = new V2Service({ query } as unknown as DataSource);

      await expect(
        service.deleteUser('10000000-0000-4000-8000-000000000001'),
      ).rejects.toMatchObject({
        status: 409,
        message: 'No se puede eliminar el usuario porque tiene registros asociados.',
      });
    });

    it('keeps administrator accounts protected', async () => {
      const query = jest.fn().mockResolvedValueOnce([
        { id: '10000000-0000-4000-8000-000000000002', role: 'ADMIN' },
      ]);
      const service = new V2Service({ query } as unknown as DataSource);

      await expect(
        service.deleteUser('10000000-0000-4000-8000-000000000002'),
      ).rejects.toMatchObject({
        status: 403,
        message: 'No se puede eliminar una cuenta administradora.',
      });
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('deletes an unreferenced regular user', async () => {
      const id = '10000000-0000-4000-8000-000000000003';
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ id, role: 'USER' }])
        .mockResolvedValueOnce([{ id }]);
      const service = new V2Service({ query } as unknown as DataSource);

      await expect(service.deleteUser(id)).resolves.toBeUndefined();
      expect(query).toHaveBeenLastCalledWith(
        'DELETE FROM users WHERE id::text=$1 RETURNING id',
        [id],
      );
    });
  });

  it('uses the correct placeholder when counting a filtered brand list', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }]);
    const service = new V2Service({ query } as unknown as DataSource);

    await expect(
      service.catalogList('brands', {
        page: 1,
        limit: 10,
        search: 'prue',
      }),
    ).resolves.toEqual({ data: [], total: 0, page: 1, limit: 10 });

    expect(query.mock.calls[0]).toEqual([
      'SELECT * FROM brands WHERE name ILIKE $3 ORDER BY id LIMIT $1 OFFSET $2',
      [10, 0, '%prue%'],
    ]);
    expect(query.mock.calls[1]).toEqual([
      'SELECT count(*) count FROM brands WHERE name ILIKE $1',
      ['%prue%'],
    ]);
  });

  it('returns the existing vehicle when the same creation form is retried', async () => {
    const body: VehicleDto = {
      brandId: '10000000-0000-4000-8000-000000000001',
      modelId: '10000000-0000-4000-8000-000000000011',
      categoryId: '10000000-0000-4000-8000-000000000021',
      locationId: '10000000-0000-4000-8000-000000000031',
      supplierId: 1,
      depotId: 1,
      year: 2026,
      color: 'Blanco',
      licensePlate: 'PBA-1234',
      transmission: 'AUTOMATIC',
      fuelType: 'HYBRID',
      seats: 5,
      doors: 4,
      bagCapacity: 2,
      pricePerDay: 50,
      mileage: 100,
      description: 'Vehículo de auditoría',
      status: 'AVAILABLE',
      active: true,
      quantity: 3,
    };
    const existing = {
      id: '20000000-0000-4000-8000-000000000001',
      brand_id: body.brandId,
      model_id: body.modelId,
      category_id: body.categoryId,
      location_id: body.locationId,
      supplier_id: body.supplierId,
      depot_id: body.depotId,
      year: body.year,
      color: body.color,
      license_plate: body.licensePlate,
      transmission: body.transmission,
      fuel_type: body.fuelType,
      seats: body.seats,
      doors: body.doors,
      bag_capacity: body.bagCapacity,
      price_per_day: String(body.pricePerDay),
      mileage: body.mileage,
      description: body.description,
      status: body.status,
      active: body.active,
      stock_total: 3,
      stock_available: 3,
    };
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([existing]),
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([]);
    const db = {
      transaction: jest.fn(
        async (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
      query,
    } as unknown as DataSource;
    const service = new V2Service(db);

    await expect(service.writeVehicle(body)).resolves.toMatchObject({
      id: existing.id,
      licensePlate: body.licensePlate,
    });
    expect(
      manager.query.mock.calls.some(([sql]) =>
        String(sql).startsWith('INSERT INTO vehicles'),
      ),
    ).toBe(false);
  });
});
