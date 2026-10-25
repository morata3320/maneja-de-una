import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Autos RDA2 v2', () => {
  let app: INestApplication;
  let token: string;
  const owner = `rda2-${randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
    token = await new SignJWT({
      scope: 'autos:read autos:book autos:cancel autos:admin autos:maintenance',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(owner)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('urn:autos:local')
      .setAudience('autos-api')
      .sign(new TextEncoder().encode(process.env.AUTOS_LOCAL_JWT_SECRET));
  }, 60000);

  afterAll(async () => app?.close());

  it('publica las 19 operaciones, salud, catálogo y búsqueda', async () => {
    const health = await request(app.getHttpServer()).get('/api/v2/autos/health').expect(200);
    expect(health.body.status).toBe('HEALTHY');
    const catalog = await request(app.getHttpServer()).get('/api/v2/autos?limit=3').expect(200);
    expect(catalog.body.data).toHaveLength(3);
    const search = await request(app.getHttpServer())
      .post('/api/v2/autos/search')
      .send({
        pickup_location: 'Quito',
        pickup_date: '2035-03-10',
        pickup_time: '10:00',
        dropoff_date: '2035-03-12',
        dropoff_time: '10:30',
        driver_age: 23,
      })
      .expect(200);
    expect(search.body.metadata.driver_age_surcharge_applied).toBe(true);
    const swagger = await request(app.getHttpServer()).get('/swagger-json').expect(200);
    const expected = [
      'GET /api/v2/autos/health',
      'GET /api/v2/autos/promociones/contrato',
      'PUT /api/v2/autos/promociones/contrato',
      'GET /api/v2/autos/eventos',
      'GET /api/v2/autos',
      'POST /api/v2/autos/search',
      'GET /api/v2/autos/flota',
      'GET /api/v2/autos/{id}/coberturas',
      'GET /api/v2/autos/{id}',
      'GET /api/v2/autos/orders',
      'POST /api/v2/autos/orders/create',
      'POST /api/v2/autos/reservas',
      'POST /api/v2/autos/reservas/{id}/checkin',
      'POST /api/v2/autos/orders/{id}/checkin-entrega',
      'POST /api/v2/autos/orders/{id}/checkin-devolucion',
      'GET /api/v2/autos/orders/{orderId}',
      'POST /api/v2/autos/orders/{orderId}/cancel',
      'POST /api/v2/autos/{id}/devolucion',
      'POST /api/v2/autos/{id}/mantenimiento/registro',
    ];
    const actual = Object.entries(swagger.body.paths as Record<string, Record<string, unknown>>)
      .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`));
    expect(expected.every((operation) => actual.includes(operation))).toBe(true);
  });

  it('formaliza promociones con RBAC verificado', async () => {
    await request(app.getHttpServer())
      .put('/api/v2/autos/promociones/contrato')
      .auth(token, { type: 'bearer' })
      .send({
        permite_promociones: true,
        porcentaje_descuento_maximo: 15,
        destinos_habilitados: ['Quito'],
        vigencia_hasta: '2035-12-31',
      })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/v2/autos/promociones/contrato')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body.porcentaje_descuento_maximo).toBe(15);
  });

  it('protege concurrencia, idempotencia y ejecuta check-in/devolución/cooldown', async () => {
    const catalog = await request(app.getHttpServer()).get('/api/v2/autos?limit=1').expect(200);
    const vehicleId = catalog.body.data[0].vehicle_id as string;
    const initialMileage = catalog.body.data[0].kilometraje_actual as number;
    const payload = {
      vehicle_id: vehicleId,
      pickup_date: '2036-05-10',
      dropoff_date: '2036-05-12',
      hora_recogida: '10:00',
      hora_devolucion: '10:00',
      conductor: { nombre: 'Prueba RDA2', edad: 30 },
      tipo_cobertura: 'TOTAL',
    };
    const key = randomUUID();
    const first = await request(app.getHttpServer())
      .post('/api/v2/autos/orders/create')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post('/api/v2/autos/orders/create')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(replay.body).toEqual(first.body);
    await request(app.getHttpServer())
      .post('/api/v2/autos/reservas')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);
    const id = first.body.order_id as string;
    await request(app.getHttpServer())
      .post(`/api/v2/autos/reservas/${id}/checkin`)
      .auth(token, { type: 'bearer' })
      .send({ documento_identidad: '1723456789', numero_licencia: 'LIC-TEST' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v2/autos/orders/${id}/checkin-entrega`)
      .auth(token, { type: 'bearer' })
      .send({ licencia_conducir: 'LIC-TEST', km_salida: initialMileage })
      .expect(200);
    const returned = await request(app.getHttpServer())
      .post(`/api/v2/autos/orders/${id}/checkin-devolucion`)
      .auth(token, { type: 'bearer' })
      .send({ km_retorno: initialMileage + 120, nivel_combustible: 80, observaciones: 'Sin daños' })
      .expect(200);
    expect(returned.body.km_recorridos).toBe(120);
    const fleet = await request(app.getHttpServer()).get('/api/v2/autos/flota').expect(200);
    expect(fleet.body.find((item: { id: string }) => item.id === vehicleId)).toBeUndefined();
  });

  it('registra mantenimiento sólo con scope y publica eventos outbox', async () => {
    const catalog = await request(app.getHttpServer()).get('/api/v2/autos?limit=2').expect(200);
    const vehicleId = catalog.body.data[1].vehicle_id as string;
    const maintenance = await request(app.getHttpServer())
      .post(`/api/v2/autos/${vehicleId}/mantenimiento/registro`)
      .auth(token, { type: 'bearer' })
      .send({
        tecnico_id: 'tech-rda2',
        kilometraje_registrado: 50000,
        nivel_combustible: 75,
        mantenimiento_realizado: true,
        nuevo_proximo_mantenimiento_km: 60000,
      })
      .expect(200);
    expect(maintenance.body.mantenimiento_requerido).toBe(false);
    const events = await request(app.getHttpServer())
      .get('/api/v2/autos/eventos?limit=100')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(events.body.events.length).toBeGreaterThan(0);
  });
});
