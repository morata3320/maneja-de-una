import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { seedId } from '../src/persistence/seed-data';
import { randomUUID } from 'node:crypto';

const cedula = (firstNine: string) => {
  const sum = firstNine.split('').reduce((total, value, index) => {
    const product = Number(value) * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return firstNine + ((10 - (sum % 10)) % 10);
};

describe('Marketplace API V2', () => {
  let app: INestApplication, db: DataSource, token: string, adminToken: string, otherToken: string;
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
        expect(body).toMatchObject({ role: 'USER', firstName: 'Ana', lastName: 'Prueba', email });
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
  });

  it('lista vehiculos con paginacion, filtros y HATEOAS', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v2/vehicles?page=1&limit=5&sort=price_asc')
      .expect(200);
    expect(list.body.data).toHaveLength(5);
    expect(list.body.total).toBe(16);
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
    const base = { reservationId, cardholderName: 'Ana Prueba', expiryMonth: 12, expiryYear: 2030, cvv: '123' };
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(token, { type: 'bearer' }).send({ ...base, expiryYear: new Date().getFullYear() - 1, cardNumber: arbitraryCardA }).expect(400);
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(token, { type: 'bearer' }).send({ ...base, cvv: '12', cardNumber: arbitraryCardA }).expect(400);
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(token, { type: 'bearer' }).send({ ...base, cardNumber: '1'.repeat(12) }).expect(400);
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(token, { type: 'bearer' }).send({ ...base, cardNumber: '1'.repeat(14) + 'A' }).expect(400);

    const otherEmail = 'v2.other@example.test';
    await request(app.getHttpServer()).post('/api/v2/auth/register').send({ firstName: 'Otro', lastName: 'Usuario', email: otherEmail, password, cedula: cedula('092345678'), phone: '+593981234567' }).expect(201);
    const otherLogin = await request(app.getHttpServer()).post('/api/v2/auth/login').send({ email: otherEmail, password }).expect(200);
    otherToken = otherLogin.body.accessToken;
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(otherToken, { type: 'bearer' }).send({ ...base, cardNumber: arbitraryCardA }).expect(403);

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

    const secondReservation = await request(app.getHttpServer()).post('/api/v2/reservations').auth(token, { type: 'bearer' }).send({ vehicleId: seedId(102), startDate: '2030-01-10T10:00:00Z', endDate: '2030-01-13T10:00:00Z' }).expect(201);
    await request(app.getHttpServer()).post('/api/v2/payments/simulate').auth(token, { type: 'bearer' }).send({ ...base, reservationId: secondReservation.body.id, cardNumber: arbitraryCardB, cvv: '1234' }).expect(201).expect(({ body }) => expect(body.card).toEqual({ brand: 'UNKNOWN', last4: '3456' }));
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
    const paidId = (globalThis as unknown as { reservationId: string }).reservationId;
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
    const paid = mine.body.data.find((row: { id: string }) => row.id === paidId);
    expect(paid).toMatchObject({
      status: 'CONFIRMED',
      vehicle: { id: seedId(101), name: 'Toyota Corolla' },
      customer: { email },
      payment: { status: 'APPROVED', brand: 'UNKNOWN', last4: '1111' },
      pickupDepot: { id: 1, location: 'Aeropuerto Quito' },
    });
    expect(mine.body.data.find((row: { id: string }) => row.id === unpaid.body.id))
      .toMatchObject({ payment: null, pickupDepot: { id: 3, location: 'Aeropuerto Guayaquil' } });

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
      [legacyId, seedId(104), `LEGACY-${legacyId}`, { pickup: null }, new Date('2032-03-10T10:00:00Z'), new Date('2032-03-12T10:00:00Z')],
    );
    const admin = await request(app.getHttpServer())
      .get('/api/v2/reservations?status=PENDING&page=1&limit=100')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(admin.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unpaid.body.id, payment: null }),
      expect.objectContaining({ id: legacyId, customer: null }),
    ]));
    expect(admin.body.data.every((row: { status: string }) => row.status === 'PENDING')).toBe(true);

    const search = await request(app.getHttpServer())
      .get(`/api/v2/reservations?search=${encodeURIComponent(email)}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(search.body.data.some((row: { id: string }) => row.id === paidId)).toBe(true);
  });
});
