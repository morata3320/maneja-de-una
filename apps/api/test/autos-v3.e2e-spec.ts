import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Autos RDA2 v3 sobre datos MANEJA DE UNA', () => {
  let app: INestApplication;
  let db: DataSource;
  let integrationToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
    db = app.get(DataSource);
    integrationToken = await new SignJWT({
      scope: 'autos:read autos:book autos:cancel autos:admin autos:maintenance',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(`booking-v3-${randomUUID()}`)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('urn:autos:local')
      .setAudience('autos-api')
      .sign(new TextEncoder().encode(process.env.AUTOS_LOCAL_JWT_SECRET));
  }, 60_000);

  afterAll(async () => app?.close());

  it('reserva catálogo real, protege concurrencia, libera stock y aparece en admin', async () => {
    const catalog = await request(app.getHttpServer())
      .get('/api/v3/autos?limit=10')
      .expect(200);
    expect(catalog.body.total).toBe(10);
    expect(
      catalog.body.data.some(
        (vehicle: { marca: string; modelo: string }) =>
          vehicle.marca === 'Toyota' && vehicle.modelo === 'Corolla',
      ),
    ).toBe(true);
    const vehicleId = catalog.body.data[0].vehicle_id as string;
    const payload = {
      vehicle_id: vehicleId,
      pickup_date: '2042-05-10',
      pickup_time: '10:00',
      dropoff_date: '2042-05-12',
      dropoff_time: '10:00',
      pickup_location: 'Quito',
      dropoff_location: 'Quito',
      coverage_type: 'TOTAL',
      driver: {
        full_name: 'Booking Integration Test',
        email: 'booking@example.test',
        phone: '+593991234567',
        license_number: 'LIC-V3-001',
        country_license: 'Ecuador',
        age: 30,
      },
    };
    const key = randomUUID();
    const created = await request(app.getHttpServer())
      .post('/api/v3/autos/reservas')
      .auth(integrationToken, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .set('X-Correlation-Id', 'v3-e2e-create')
      .send(payload)
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'RESERVADO',
      vehicle_id: vehicleId,
    });
    expect(created.body.pnr).toBeTruthy();
    expect(created.body.voucher_qr_payload).toContain(created.body.pnr);

    const replay = await request(app.getHttpServer())
      .post('/api/v3/autos/reservas')
      .auth(integrationToken, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(replay.body.order_id).toBe(created.body.order_id);

    const unavailable = await request(app.getHttpServer())
      .post('/api/v3/autos/orders/create')
      .auth(integrationToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);
    expect(unavailable.body.code).toBe('VEHICLE_UNAVAILABLE');

    const underage = await request(app.getHttpServer())
      .post('/api/v3/autos/reservas')
      .auth(integrationToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        ...payload,
        vehicle_id: catalog.body.data[1].vehicle_id,
        driver: { ...payload.driver, age: 17 },
      })
      .expect(422);
    expect(underage.body.code).toBe('DRIVER_UNDERAGE');

    const concurrentPayload = {
      ...payload,
      vehicle_id: catalog.body.data[2].vehicle_id,
      pickup_date: '2042-06-10',
      dropoff_date: '2042-06-12',
      driver: { ...payload.driver, license_number: 'LIC-V3-CONCURRENT' },
    };
    const concurrent = await Promise.all(
      [randomUUID(), randomUUID()].map((idempotencyKey) =>
        request(app.getHttpServer())
          .post('/api/v3/autos/reservas')
          .auth(integrationToken, { type: 'bearer' })
          .set('Idempotency-Key', idempotencyKey)
          .send(concurrentPayload),
      ),
    );
    expect(concurrent.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const concurrentWinner = concurrent.find(({ status }) => status === 201);
    expect(concurrent.find(({ status }) => status === 409)?.body.code).toBe(
      'VEHICLE_UNAVAILABLE',
    );
    await request(app.getHttpServer())
      .post(
        `/api/v3/autos/orders/${String(concurrentWinner?.body.order_id)}/cancel`,
      )
      .auth(integrationToken, { type: 'bearer' })
      .send({ reason: 'E2E concurrency cleanup' })
      .expect(200);

    const [orderRow] = await db.query<
      Array<{ driver_details: Record<string, unknown> }>
    >('SELECT driver_details FROM orders WHERE id=$1', [created.body.order_id]);
    expect(orderRow.driver_details.email).toBe(payload.driver.email);
    const [reservedStock] = await db.query<
      Array<{ available_units: number; acknowledged_at: Date | null }>
    >(
      'SELECT available_units,acknowledged_at FROM inventory_stock_outbox WHERE correlation_id=$1',
      ['v3-e2e-create'],
    );
    expect(reservedStock).toMatchObject({
      available_units: 0,
      acknowledged_at: null,
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    const adminReservations = await request(app.getHttpServer())
      .get('/api/v2/reservations?limit=100')
      .auth(adminLogin.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(
      adminReservations.body.data.some(
        (order: { id: string }) => order.id === created.body.order_id,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v3/autos/orders/${created.body.order_id}/cancel`)
      .auth(integrationToken, { type: 'bearer' })
      .send({ reason: 'E2E' })
      .expect(200);
    const released = await request(app.getHttpServer())
      .post('/api/v3/autos/reservas')
      .auth(integrationToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    expect(released.body.order_id).not.toBe(created.body.order_id);
    await request(app.getHttpServer())
      .post(`/api/v3/autos/orders/${released.body.order_id}/cancel`)
      .auth(integrationToken, { type: 'bearer' })
      .send({ reason: 'E2E cleanup' })
      .expect(200);
  });

  it('expone en Swagger las mismas 19 operaciones V3', async () => {
    const swagger = await request(app.getHttpServer())
      .get('/swagger-json')
      .expect(200);
    const operations = Object.entries(
      swagger.body.paths as Record<string, Record<string, unknown>>,
    )
      .flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .filter((operation) => operation.includes('/api/v3/autos'));
    expect(operations).toHaveLength(19);
  });
});
