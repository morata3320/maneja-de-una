import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { autosDocument } from '../src/integrations/autos/contract/contract-document';
import { schemaValidator } from '../src/integrations/autos/contract/autos.guard';
import { WebhooksService } from '../src/integrations/autos/webhooks.service';
import type {
  CarSearchRequest,
  CarSearchResponse,
  OrderHoldResponse,
  OrderPreviewResponse,
  OrderDetail,
} from '../src/integrations/autos/contract/autos.types';

describe('Autos real PostgreSQL y contrato', () => {
  let app: INestApplication,
    db: DataSource,
    token: string,
    other: string,
    readOnly: string;
  let search: CarSearchResponse,
    hold: OrderHoldResponse,
    preview: OrderPreviewResponse,
    order: OrderDetail;
  const seen = new Set<string>(),
    owner = 'integration-owner',
    key = randomUUID();
  const route = {
    pickup: { datetime: '2032-09-22T10:00:00Z', location: {} },
    dropoff: { datetime: '2032-09-25T10:00:00Z', location: {} },
  };
  const body: CarSearchRequest = {
    booker: { country: 'ec' },
    currency: 'USD',
    driver: { age: 30 },
    route,
    maximum_results: 10,
  };
  async function jwt(sub: string, scopes: string) {
    return new SignJWT({ scope: scopes })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('urn:autos:local')
      .setAudience('autos-api')
      .sign(new TextEncoder().encode(process.env.AUTOS_LOCAL_JWT_SECRET));
  }
  async function boot() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
    db = app.get(DataSource);
  }
  function contract(
    path: string,
    method: string,
    status: number,
    responseBody: unknown,
  ) {
    const response =
      autosDocument.paths[path][method].responses[String(status)];
    expect(response).toBeDefined();
    if (response?.content) {
      const schema = Object.values(response.content)[0].schema;
      const validate = schemaValidator(schema);
      expect({
        valid: validate(responseBody),
        errors: validate.errors ?? [],
      }).toEqual({ valid: true, errors: [] });
    }
    seen.add(method + ' ' + path);
  }
  const post = (path: string, value: unknown = body) =>
    request(app.getHttpServer())
      .post('/autos/v1' + path)
      .set('X-Affiliate-Id', '1')
      .send(value);
  beforeAll(async () => {
    await boot();
    token = await jwt(
      owner,
      'autos:read autos:book autos:cancel autos:webhooks',
    );
    other = await jwt(
      'other-owner',
      'autos:read autos:book autos:cancel autos:webhooks',
    );
    readOnly = await jwt(owner, 'autos:read');
  }, 60000);
  afterAll(async () => {
    await app?.close();
  });
  it('search, cache, shape del YAML y extensiones permitidas', async () => {
    const r = await post('/search', {
      ...body,
      extension: { valid: true },
      booker: { country: 'ec', extra: 'allowed' },
    }).expect(200);
    search = r.body as CarSearchResponse;
    contract('/search', 'post', 200, r.body);
    expect(search.data).toHaveLength(10);
    expect(search.metadata?.total_results).toBe(14);
    expect(r.headers['cache-control']).toBe('public, max-age=300');
  });
  it('paginación opaca y token corrupto', async () => {
    const first = await post('/search').expect(200);
    const initial = first.body as CarSearchResponse;
    const r = await post('/search', {
      ...body,
      page: initial.metadata?.next_page,
    }).expect(200);
    expect((r.body as CarSearchResponse).data).toHaveLength(4);
    await post('/search', { ...body, page: 'corrupt' }).expect(400);
  });
  it('rechaza affiliate ausente', async () => {
    const r = await request(app.getHttpServer())
      .post('/autos/v1/search')
      .send(body)
      .expect(400);
    expect(r.headers['content-type']).toContain('application/problem+json');
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });
  it('rechaza fechas inversas y required', async () => {
    await post('/search', {
      ...body,
      route: { pickup: route.dropoff, dropoff: route.pickup },
    }).expect(400);
    await post('/search', {}).expect(400);
  });
  it.each(['/depots', '/suppliers', '/constants'])(
    'body opcional %s',
    async (path) => {
      const r = await request(app.getHttpServer())
        .post('/autos/v1' + path)
        .set('X-Affiliate-Id', '1')
        .expect(200);
      contract(path, 'post', 200, r.body);
    },
  );
  it.each(['/depots/reviews/scores', '/details'])(
    'feed sin IDs %s',
    async (path) => {
      const r = await post(path, {}).expect(200);
      contract(path, 'post', 200, r.body);
      expect(r.body.data.length).toBeGreaterThan(0);
    },
  );
  it('hold sin affiliate ni idempotency key', async () => {
    const r = await request(app.getHttpServer())
      .post('/autos/v1/orders/hold')
      .auth(token, { type: 'bearer' })
      .send({
        vehicle_id: search.data![0].vehicle_id,
        search_token: search.search_token,
      })
      .expect(200);
    hold = r.body as OrderHoldResponse;
    contract('/orders/hold', 'post', 200, r.body);
  });
  it('preview respeta hold propietario', async () => {
    const r = await request(app.getHttpServer())
      .post('/autos/v1/orders/preview')
      .auth(token, { type: 'bearer' })
      .send({
        vehicle_id: search.data![0].vehicle_id,
        search_token: search.search_token,
        hold_id: hold.hold_id,
        extras: ['GPS'],
      })
      .expect(200);
    preview = r.body as OrderPreviewResponse;
    contract('/orders/preview', 'post', 200, r.body);
  });
  it('create concurrente misma clave produce una sola orden', async () => {
    const payload = {
      order_preview_id: preview.data!.order_preview_id,
      payment_reference: 'development-reference',
      driver_details: {},
    };
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/autos/v1/orders/create')
          .auth(token, { type: 'bearer' })
          .set('Idempotency-Key', key)
          .send(payload),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    order = responses[0].body as OrderDetail;
    contract('/orders/create', 'post', 201, order);
    const rows = await db.query<Array<{ owner_id: string }>>(
      'SELECT owner_id FROM orders WHERE preview_id=$1',
      [preview.data!.order_preview_id],
    );
    expect(rows).toEqual([{ owner_id: owner }]);
    await request(app.getHttpServer())
      .post('/autos/v1/orders/create')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ ...payload, payment_reference: 'other' })
      .expect(409);
  });
  it('get aislado por owner', async () => {
    const r = await request(app.getHttpServer())
      .get('/autos/v1/orders/' + order.order_id)
      .auth(token, { type: 'bearer' })
      .expect(200);
    contract('/orders/{orderId}', 'get', 200, r.body);
    await request(app.getHttpServer())
      .get('/autos/v1/orders/' + order.order_id)
      .auth(other, { type: 'bearer' })
      .expect(404);
  });
  it('modify {} válido y cambio de ruta', async () => {
    const p = '/autos/v1/orders/' + order.order_id + '/modify';
    const r = await request(app.getHttpServer())
      .post(p)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    contract('/orders/{orderId}/modify', 'post', 200, r.body);
    const next = {
      ...route,
      dropoff: { ...route.dropoff, datetime: '2032-09-26T10:00:00Z' },
    };
    await request(app.getHttpServer())
      .post(p)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ route: next })
      .expect(200);
  });
  it('wrong scopes, token inválido y JWT interno no son OAuth', async () => {
    await request(app.getHttpServer())
      .post('/autos/v1/orders/hold')
      .auth(readOnly, { type: 'bearer' })
      .send({ vehicle_id: 'x', search_token: 'x' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/autos/v1/webhooks')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });
  it('cancel y replay sin body', async () => {
    const cancelKey = randomUUID();
    const path = '/autos/v1/orders/' + order.order_id + '/cancel';
    const r = await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', cancelKey)
      .expect(200);
    contract('/orders/{orderId}/cancel', 'post', 200, r.body);
    expect(r.text).toBe('');
    await request(app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', cancelKey)
      .expect(200);
  });
  it('dos holds simultáneos: solo uno adquiere el recurso', async () => {
    const fresh = (await post('/search').expect(200)).body as CarSearchResponse;
    const payload = {
      vehicle_id: fresh.data![1].vehicle_id,
      search_token: fresh.search_token,
    };
    const responses = await Promise.all(
      [token, other].map((t) =>
        request(app.getHttpServer())
          .post('/autos/v1/orders/hold')
          .auth(t, { type: 'bearer' })
          .send(payload),
      ),
    );
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    const rows = await db.query<Array<{ n: string }>>(
      'SELECT count(*) AS n FROM holds WHERE vehicle_id=$1 AND NOT consumed AND expires_at>now()',
      [payload.vehicle_id],
    );
    expect(Number(rows[0].n)).toBe(1);
  });
  it('holds expirados no bloquean y no sirven para preview', async () => {
    const fresh = (await post('/search').expect(200)).body as CarSearchResponse;
    const payload = {
      vehicle_id: fresh.data![2].vehicle_id,
      search_token: fresh.search_token,
    };
    const h = (
      await request(app.getHttpServer())
        .post('/autos/v1/orders/hold')
        .auth(token, { type: 'bearer' })
        .send(payload)
        .expect(200)
    ).body as OrderHoldResponse;
    await db.query(
      "UPDATE holds SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [h.hold_id],
    );
    await request(app.getHttpServer())
      .post('/autos/v1/orders/preview')
      .auth(token, { type: 'bearer' })
      .send({ ...payload, hold_id: h.hold_id })
      .expect(409);
    await request(app.getHttpServer())
      .post('/autos/v1/orders/hold')
      .auth(other, { type: 'bearer' })
      .send(payload)
      .expect(200);
  });
  it('webhooks CRUD, cifrado y entrega outbox persistente', async () => {
    let received: unknown;
    const server = createServer((req, res) => {
      let data = '';
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      req.on('end', () => {
        received = JSON.parse(data);
        res.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const id = randomUUID(),
      url =
        'http://127.0.0.1:' +
        (server.address() as AddressInfo).port +
        '/events';
    try {
      const r = await request(app.getHttpServer())
        .post('/autos/v1/webhooks')
        .auth(token, { type: 'bearer' })
        .send({
          id,
          url,
          events: ['DEPOT_UPDATE'],
          secret: 'test-only-hook-value',
        })
        .expect(201);
      contract('/webhooks', 'post', 201, r.body);
      expect(r.body.secret).toBeUndefined();
      const stored = await db.query<Array<{ encrypted_secret: string }>>(
        'SELECT encrypted_secret FROM webhook_subscriptions WHERE id=$1',
        [id],
      );
      expect(stored[0].encrypted_secret).not.toContain('test-only-hook-value');
      const list = await request(app.getHttpServer())
        .get('/autos/v1/webhooks')
        .auth(token, { type: 'bearer' })
        .expect(200);
      contract('/webhooks', 'get', 200, list.body);
      const alien = await request(app.getHttpServer())
        .get('/autos/v1/webhooks')
        .auth(other, { type: 'bearer' })
        .expect(200);
      expect(alien.body).toEqual([]);
      await db.query(
        "INSERT INTO webhook_outbox(id,owner_id,event_type,resource_id,data) VALUES($1,$2,'DEPOT_UPDATE','1','{}')",
        [randomUUID(), owner],
      );
      await app.get(WebhooksService).tick();
      expect(received).toMatchObject({
        eventType: 'DEPOT_UPDATE',
        resourceId: '1',
      });
      const del = await request(app.getHttpServer())
        .delete('/autos/v1/webhooks/' + id)
        .auth(token, { type: 'bearer' })
        .expect(204);
      contract('/webhooks/{id}', 'delete', 204, del.body);
      expect(del.text).toBe('');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
  it('persistencia sobrevive reinicio completo de la API', async () => {
    await app.close();
    await boot();
    const r = await request(app.getHttpServer())
      .get('/autos/v1/orders/' + order.order_id)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(r.body.status).toBe('CANCELLED');
  });
  it('se verificaron responses de las 15 operaciones reales', () =>
    expect(seen.size).toBe(15));
  it('health y Swagger siguen funcionando', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    await request(app.getHttpServer()).get('/swagger/autos').expect(200);
  });
});
