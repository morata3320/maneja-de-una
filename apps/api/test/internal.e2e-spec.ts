import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { seedId } from '../src/persistence/seed-data';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string; passwordHash?: string };
}

describe('API interna con PostgreSQL real', () => {
  let app: INestApplication;
  let db: DataSource;
  let customerToken: string;
  let adminToken: string;
  const email = 'cliente.e2e@example.com';
  const password = 'correct-horse-battery-staple';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
    db = app.get(DataSource);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('registra, autentica y expone sólo el usuario público', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Cliente E2E', email, password })
      .expect(201);
    expect(registered.body).toMatchObject({
      name: 'Cliente E2E',
      email,
      role: 'CUSTOMER',
      active: true,
    });
    expect(registered.body.passwordHash).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Duplicado', email, password })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrect-password' })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    const body = login.body as LoginResponse;
    customerToken = body.accessToken;
    expect(body.user).toMatchObject({ email, role: 'CUSTOMER' });
    expect(body.user.passwordHash).toBeUndefined();

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .auth(customerToken, { type: 'bearer' })
      .expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('mantiene favoritos únicos y aislados por usuario', async () => {
    const vehicleId = seedId(101);
    await request(app.getHttpServer())
      .post('/api/v1/favorites/' + vehicleId)
      .auth(customerToken, { type: 'bearer' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/favorites/' + vehicleId)
      .auth(customerToken, { type: 'bearer' })
      .expect(201);

    const favorites = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .auth(customerToken, { type: 'bearer' })
      .expect(200);
    expect(favorites.body).toHaveLength(1);
    expect(favorites.body[0].vehicleId).toBe(vehicleId);

    const [count] = await db.query<Array<{ total: string }>>(
      'SELECT count(*) AS total FROM favorites WHERE vehicle_id=$1',
      [vehicleId],
    );
    expect(Number(count.total)).toBe(1);

    await request(app.getHttpServer())
      .delete('/api/v1/favorites/' + vehicleId)
      .auth(customerToken, { type: 'bearer' })
      .expect(204);
  });

  it('separa tokens internos del OAuth contractual', async () => {
    await request(app.getHttpServer())
      .post('/autos/v1/orders/hold')
      .auth(customerToken, { type: 'bearer' })
      .send({ vehicle_id: seedId(101), search_token: 'invalid' })
      .expect(401);
  });

  it('protege administración por rol', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/vehicles')
      .auth(customerToken, { type: 'bearer' })
      .expect(403);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = (login.body as LoginResponse).accessToken;
  });

  it('ofrece CRUD desactivable, filtros y paginación administrativa', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Furgoneta E2E', description: 'Temporal' })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'Furgoneta E2E',
      active: true,
    });

    const id = created.body.id as string;
    await request(app.getHttpServer())
      .patch('/api/v1/admin/categories/' + id)
      .auth(adminToken, { type: 'bearer' })
      .send({ description: 'Actualizada' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.description).toBe('Actualizada');
      });

    const vehicles = await request(app.getHttpServer())
      .get(
        '/api/v1/admin/vehicles?status=AVAILABLE&page=1&limit=5&sort=pricePerDay&order=desc',
      )
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(vehicles.body.data).toHaveLength(5);
    expect(vehicles.body.total).toBe(14);
    expect(
      vehicles.body.data.every(
        (v: { status: string }) => v.status === 'AVAILABLE',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Inválida', unknown: true })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/unknown-table')
      .auth(adminToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .delete('/api/v1/admin/categories/' + id)
      .auth(adminToken, { type: 'bearer' })
      .expect(204);
    const disabled = await request(app.getHttpServer())
      .get('/api/v1/admin/categories/' + id)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(disabled.body.active).toBe(false);
  });

  it('expone consulta administrativa de órdenes', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/admin/orders?limit=10&page=1')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(Array.isArray(result.body)).toBe(true);
  });
});
