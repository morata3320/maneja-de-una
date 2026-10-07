import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { seedId } from '../src/persistence/seed-data';
import {
  expandedCatalog,
  seedVehicleCatalog,
} from '../src/persistence/catalog-seed-data';
import { randomUUID } from 'node:crypto';

const cedula = (firstNine: string) => {
  const sum = firstNine.split('').reduce((total, value, index) => {
    const product = Number(value) * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return firstNine + ((10 - (sum % 10)) % 10);
};

describe('Marketplace API V2', () => {
  let app: INestApplication,
    db: DataSource,
    token: string,
    adminToken: string,
    otherToken: string;
  const email = 'v2.user@example.test',
    password = 'Password9',
    arbitraryCardA = '1'.repeat(15),
    arbitraryCardB = '12345678' + '90123456';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
    db = app.get(DataSource);
  }, 60_000);
  afterAll(() => app?.close());

  it('amplia el catalogo idempotentemente con marcas y relaciones correctas', async () => {
    expect(await seedVehicleCatalog(db)).toBe(0);
    expect(await seedVehicleCatalog(db)).toBe(0);
    const [counts] = await db.query<
      Array<{ vehicles: string; models: string; brands: string }>
    >(`SELECT
         (SELECT count(*) FROM vehicles) vehicles,
         (SELECT count(DISTINCT model_id) FROM vehicles) models,
         (SELECT count(*) FROM brands) brands`);
    expect(counts).toEqual({ vehicles: '29', models: '16', brands: '10' });
    const relations = await db.query<
      Array<{ brand: string; model: string; license_plate: string }>
    >(`SELECT b.name brand,vm.name model,v.license_plate
       FROM vehicles v
       JOIN brands b ON b.id=v.brand_id
       JOIN vehicle_models vm ON vm.id=v.model_id AND vm.brand_id=v.brand_id
       WHERE v.license_plate LIKE 'MDU-%'`);
    expect(relations).toHaveLength(13);
    expect(
      relations.map(({ brand, model }) => `${brand} ${model}`).sort(),
    ).toEqual(
      expandedCatalog.map(({ brand, model }) => `${brand} ${model}`).sort(),
    );
  });

  it('registra USER sin permitir mass assignment y autentica JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'Prueba',
        email,
        password,
        cedula: cedula('171234567'),
        phone: '+593991234567',
        role: 'ADMIN',
      })
      .expect(400);
    const registered = await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'Prueba',
        email,
        password,
        cedula: cedula('171234567'),
        phone: '+593991234567',
      })
      .expect(201);
    expect(registered.body).toMatchObject({
      email,
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(JSON.stringify(registered.body)).not.toContain('password');
    const login = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email, password })
      .expect(200);
    token = login.body.accessToken;
    await request(app.getHttpServer())
      .get('/api/v2/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          role: 'USER',
          firstName: 'Ana',
          lastName: 'Prueba',
          email,
        });
        expect(JSON.stringify(body)).not.toContain('password');
      });
  });

  it('distingue 401 de 403 y permite dashboard solo ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/admin/dashboard')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v2/admin/dashboard')
      .auth(token, { type: 'bearer' })
      .expect(403);
    const login = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = login.body.accessToken;
    await request(app.getHttpServer())
      .get('/api/v2/admin/dashboard')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    const brands = await request(app.getHttpServer())
      .get('/api/v2/brands?limit=100')
      .expect(200);
    expect(brands.body.total).toBe(10);
    const models = await request(app.getHttpServer())
      .get('/api/v2/vehicle-models?limit=100')
      .expect(200);
    expect(models.body.total).toBe(16);
    await request(app.getHttpServer())
      .patch('/api/v2/vehicles/' + seedId(117))
      .auth(adminToken, { type: 'bearer' })
      .send({ color: 'Blanco' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ model: 'RAV4', color: 'Blanco' });
      });
  });

  it('lista vehiculos con paginacion, filtros y HATEOAS', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v2/vehicles?page=1&limit=5&sort=price_asc')
      .expect(200);
    expect(list.body.data).toHaveLength(5);
    expect(list.body.total).toBe(29);
    const all = await request(app.getHttpServer())
      .get('/api/v2/vehicles?page=1&limit=100')
      .expect(200);
    expect(
      new Set(all.body.data.map((row: { model: string }) => row.model)).size,
    ).toBe(16);
    expect(all.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Toyota', model: 'RAV4' }),
        expect.objectContaining({ brand: 'Nissan', model: 'Kicks' }),
      ]),
    );
    for (const [query, expected] of [
      ['brand=Chevrolet', 2],
      ['model=RAV4', 1],
      ['category=Compact', 7],
      ['location=Aeropuerto%20Quito', 11],
    ] as const) {
      const filtered = await request(app.getHttpServer())
        .get(`/api/v2/vehicles?limit=100&${query}`)
        .expect(200);
      expect(filtered.body.total).toBe(expected);
    }
    const detail = await request(app.getHttpServer())
      .get('/api/v2/vehicles/' + seedId(101))
      .expect(200);
    expect(detail.body._links.reserve).toEqual({
      href: '/api/v2/reservations',
      method: 'POST',
    });
    expect(detail.body.pickupDepots).toEqual([
      expect.objectContaining({ id: 1, location: 'Aeropuerto Quito' }),
    ]);
  });

  it('agrega favorito, rechaza duplicado y elimina', async () => {
    const id = seedId(101);
    await request(app.getHttpServer())
      .post('/api/v2/favorites/' + id)
      .auth(token, { type: 'bearer' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v2/favorites/' + id)
      .auth(token, { type: 'bearer' })
      .expect(409);
    await request(app.getHttpServer())
      .delete('/api/v2/favorites/' + id)
      .auth(token, { type: 'bearer' })
      .expect(204);
  });

  it('crea reserva, evita double booking y protege propiedad', async () => {
    const body = {
      vehicleId: seedId(101),
      pickupDepotId: 1,
      startDate: '2030-01-10T10:00:00Z',
      endDate: '2030-01-13T10:00:00Z',
    };
    await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send({ ...body, pickupDepotId: 2 })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(201);
    expect(created.body.totalAmount).toBeGreaterThan(0);
    (globalThis as unknown as { reservationId: string }).reservationId =
      created.body.id;
    await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(409);
  });

  it('aprueba tarjetas demo arbitrarias y nunca expone ni almacena PAN/CVV', async () => {
    const reservationId = (globalThis as unknown as { reservationId: string })
      .reservationId;
    const base = {
      reservationId,
      cardholderName: 'Ana Prueba',
      expiryMonth: 12,
      expiryYear: 2030,
      cvv: '123',
    };
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({
        ...base,
        expiryYear: new Date().getFullYear() - 1,
        cardNumber: arbitraryCardA,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({ ...base, cvv: '12', cardNumber: arbitraryCardA })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({ ...base, cardNumber: '1'.repeat(12) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({ ...base, cardNumber: '1'.repeat(14) + 'A' })
      .expect(400);

    const otherEmail = 'v2.other@example.test';
    await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({
        firstName: 'Otro',
        lastName: 'Usuario',
        email: otherEmail,
        password,
        cedula: cedula('092345678'),
        phone: '+593981234567',
      })
      .expect(201);
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);
    otherToken = otherLogin.body.accessToken;
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(otherToken, { type: 'bearer' })
      .send({ ...base, cardNumber: arbitraryCardA })
      .expect(403);

    const paid = await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({
        ...base,
        cardNumber: arbitraryCardA,
      })
      .expect(201);
    const json = JSON.stringify(paid.body);
    expect(json).not.toContain('cvv');
    expect(json).not.toContain(arbitraryCardA);
    expect(paid.body.card).toEqual({ brand: 'UNKNOWN', last4: '1111' });
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({ ...base, cardNumber: arbitraryCardA })
      .expect(409);

    const secondReservation = await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send({
        vehicleId: seedId(102),
        startDate: '2030-01-10T10:00:00Z',
        endDate: '2030-01-13T10:00:00Z',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v2/payments/simulate')
      .auth(token, { type: 'bearer' })
      .send({
        ...base,
        reservationId: secondReservation.body.id,
        cardNumber: arbitraryCardB,
        cvv: '1234',
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body.card).toEqual({ brand: 'UNKNOWN', last4: '3456' }),
      );
    const columns = await db.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='payments'`,
    );
    expect(columns.map((c) => c.column_name)).not.toEqual(
      expect.arrayContaining(['cvv', 'cvc', 'card_number', 'fullCardNumber']),
    );
    expect(columns.map((c) => c.column_name)).toEqual(
      expect.arrayContaining(['card_last4', 'card_brand', 'payment_reference']),
    );
  });

  it('serializa reservas pagadas, no pagadas y relaciones opcionales sin 500', async () => {
    const paidId = (globalThis as unknown as { reservationId: string })
      .reservationId;
    const unpaid = await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send({
        vehicleId: seedId(103),
        pickupDepotId: 3,
        startDate: '2031-02-10T10:00:00Z',
        endDate: '2031-02-12T10:00:00Z',
      })
      .expect(201);
    const mine = await request(app.getHttpServer())
      .get('/api/v2/reservations/my')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const paid = mine.body.data.find(
      (row: { id: string }) => row.id === paidId,
    );
    expect(paid).toMatchObject({
      status: 'CONFIRMED',
      vehicle: { id: seedId(101), name: 'Toyota Corolla' },
      customer: { email },
      payment: { status: 'APPROVED', brand: 'UNKNOWN', last4: '1111' },
      pickupDepot: { id: 1, location: 'Aeropuerto Quito' },
    });
    expect(
      mine.body.data.find((row: { id: string }) => row.id === unpaid.body.id),
    ).toMatchObject({
      payment: null,
      pickupDepot: { id: 3, location: 'Aeropuerto Guayaquil' },
    });

    await request(app.getHttpServer())
      .get(`/api/v2/reservations/${paidId}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          id: paidId,
          payment: { status: 'APPROVED' },
          customer: { email },
        }),
      );

    await request(app.getHttpServer())
      .get(`/api/v2/reservations/${paidId}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(403);
    const otherMine = await request(app.getHttpServer())
      .get('/api/v2/reservations/my')
      .auth(otherToken, { type: 'bearer' })
      .expect(200);
    expect(otherMine.body.data).toHaveLength(0);

    const legacyId = randomUUID();
    await db.query(
      `INSERT INTO orders(id,vehicle_id,owner_id,preview_id,locator,status,route,starts_at,ends_at,price_per_day,total_amount,currency,extras,vehicle_details,driver_details,payment_reference)
       VALUES($1,$2,'legacy-owner',NULL,$3,'PENDING',$4,$5,$6,30,60,'USD','[]','{}','{}',NULL)`,
      [
        legacyId,
        seedId(104),
        `LEGACY-${legacyId}`,
        { pickup: null },
        new Date('2032-03-10T10:00:00Z'),
        new Date('2032-03-12T10:00:00Z'),
      ],
    );
    const admin = await request(app.getHttpServer())
      .get('/api/v2/reservations?status=PENDING&page=1&limit=100')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(admin.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: unpaid.body.id, payment: null }),
        expect.objectContaining({ id: legacyId, customer: null }),
      ]),
    );
    expect(
      admin.body.data.every(
        (row: { status: string }) => row.status === 'PENDING',
      ),
    ).toBe(true);

    const search = await request(app.getHttpServer())
      .get(`/api/v2/reservations?search=${encodeURIComponent(email)}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(
      search.body.data.some((row: { id: string }) => row.id === paidId),
    ).toBe(true);
  });

  it('administra stock fisico y descuenta disponibilidad sin sobre-reservar', async () => {
    const vehicleBody = {
      brandId: seedId(1),
      modelId: seedId(14),
      categoryId: seedId(22),
      locationId: seedId(31),
      supplierId: 1,
      depotId: 1,
      year: 2025,
      color: 'Blanco',
      licensePlate: 'STKTEST-001',
      transmission: 'AUTOMATIC',
      fuelType: 'HYBRID',
      seats: 5,
      doors: 4,
      bagCapacity: 2,
      pricePerDay: 68,
      mileage: 4200,
      description: 'RAV4 para prueba de stock',
      status: 'AVAILABLE',
      active: true,
      quantity: 3,
    };
    const created = await request(app.getHttpServer())
      .post('/api/v2/vehicles')
      .auth(adminToken, { type: 'bearer' })
      .send(vehicleBody)
      .expect(201);
    expect(created.body).toMatchObject({
      model: 'RAV4',
      quantity: 3,
      stockTotal: 3,
      stockAvailable: 3,
    });

    await request(app.getHttpServer())
      .put(`/api/v2/vehicles/${created.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ ...vehicleBody, quantity: 4 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ quantity: 4, stockTotal: 4 });
      });
    await request(app.getHttpServer())
      .patch(`/api/v2/vehicles/${created.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ quantity: 2 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ quantity: 2, stockTotal: 2 });
      });

    const units = await request(app.getHttpServer())
      .get('/api/v2/vehicles?model=RAV4&limit=100')
      .expect(200);
    expect(units.body.data).toHaveLength(2);
    const period = {
      startDate: '2040-01-10T10:00:00Z',
      endDate: '2040-01-12T10:00:00Z',
      pickupDepotId: 1,
    };
    const concurrent = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post('/api/v2/reservations')
          .auth(token, { type: 'bearer' })
          .send({ ...period, vehicleId: units.body.data[0].id }),
      ),
    );
    expect(concurrent.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const firstReservation = concurrent.find(({ status }) => status === 201)!;
    const secondReservation = await request(app.getHttpServer())
      .post('/api/v2/reservations')
      .auth(token, { type: 'bearer' })
      .send({ ...period, vehicleId: units.body.data[1].id })
      .expect(201);

    const availability = await request(app.getHttpServer())
      .get(
        `/api/v2/vehicles/${created.body.id}?startDate=${encodeURIComponent(period.startDate)}&endDate=${encodeURIComponent(period.endDate)}`,
      )
      .expect(200);
    expect(availability.body).toMatchObject({
      stockTotal: 2,
      stockAvailable: 0,
    });
    await request(app.getHttpServer())
      .patch(`/api/v2/vehicles/${created.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ quantity: 1 })
      .expect(409);

    for (const reservationId of [
      firstReservation.body.id,
      secondReservation.body.id,
    ])
      await request(app.getHttpServer())
        .post(`/api/v2/reservations/${reservationId}/cancel`)
        .auth(token, { type: 'bearer' })
        .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v2/vehicles/${created.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ quantity: 1 })
      .expect(200);

    const swagger = await request(app.getHttpServer())
      .get('/swagger-json')
      .expect(200);
    expect(swagger.body.components.schemas.VehicleDto.properties.quantity)
      .toMatchObject({ minimum: 0, maximum: 1000 });
    expect(swagger.body.components.schemas.VehicleStockDto.properties)
      .toEqual(expect.objectContaining({
        quantity: expect.any(Object),
        stockTotal: expect.any(Object),
        stockAvailable: expect.any(Object),
      }));
  });
});
