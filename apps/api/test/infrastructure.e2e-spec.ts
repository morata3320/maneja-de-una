import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { requestContext } from '../src/common/types/request-context';

// Exclusivo del módulo de pruebas: nunca se registra en AppModule.
class ProbeDto {
  @IsString() name: string;
}
@Controller('infrastructure-probe')
class ProbeController {
  @Post()
  echo(@Body() body: ProbeDto) {
    return { name: body.name, transformed: body instanceof ProbeDto };
  }
  @Get('unexpected')
  unexpected() {
    throw new Error('password=supersecret');
  }
  @Get('unavailable')
  unavailable() {
    throw new ServiceUnavailableException('private host and token');
  }
  @Get('limited')
  limited() {
    return { ok: true };
  }
  @Get('context')
  async context() {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return requestContext.getStore();
  }
}

describe('Infraestructura global (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const config = new ConfigService(
      validateEnvironment({
        NODE_ENV: 'test',
        RATE_LIMIT_MAX: 3,
        RATE_LIMIT_TTL_MS: 60000,
      }),
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    await configureApp(app);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('genera UUID y lo expone por CORS', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    expect(res.headers['access-control-expose-headers']).toBe(
      'X-Correlation-Id',
    );
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });
  it('reutiliza ID válido', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Correlation-Id', 'booking-123')
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('booking-123');
  });
  it('reemplaza IDs inválidos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Correlation-Id', 'invalid id')
      .expect(200);
    expect(res.headers['x-correlation-id']).not.toBe('invalid id');
  });
  it('mantiene contexto asíncrono aislado entre requests', async () => {
    const responses = await Promise.all(
      ['request-A', 'request-B'].map((id) =>
        request(app.getHttpServer())
          .get('/api/v1/infrastructure-probe/context')
          .set('X-Correlation-Id', id)
          .expect(200),
      ),
    );
    expect(responses.map((r) => r.body.correlationId)).toEqual([
      'request-A',
      'request-B',
    ]);
    expect(requestContext.getStore()).toBeUndefined();
  });
  it('normaliza 404 y omite query del path', async () => {
    const res = await request(app.getHttpServer())
      .get('/missing?token=secret')
      .set('X-Correlation-Id', 'error-123')
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/missing',
      requestId: 'error-123',
    });
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'statusCode',
        'error',
        'message',
        'path',
        'timestamp',
        'requestId',
      ].sort(),
    );
  });
  it.each([
    ['unexpected', 500],
    ['unavailable', 503],
  ])('oculta detalles en %s', async (path, code) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/infrastructure-probe/' + path)
      .expect(Number(code));
    expect(res.body.message).toBe('Internal server error');
    expect(res.body.stack).toBeUndefined();
    expect(res.body.requestId).toBe(res.headers['x-correlation-id']);
  });
  it('ValidationPipe rechaza campos desconocidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/infrastructure-probe')
      .send({ name: 'test', unknown: true })
      .expect(400);
    expect(res.body.message).toContain('property unknown should not exist');
    expect(res.body.requestId).toBe(res.headers['x-correlation-id']);
  });
  it('transforma DTO y admite JSON con sufijo', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/infrastructure-probe')
      .set('Content-Type', 'application/vnd.test+json')
      .send('{"name":"test"}')
      .expect(201);
    expect(res.body).toEqual({ name: 'test', transformed: true });
  });
  it('rechaza payload text/plain con 415', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/infrastructure-probe')
      .type('text')
      .send('wrong')
      .expect(415);
    expect(res.body.error).toBe('Unsupported Media Type');
  });
  it('normaliza JSON malformado antes de llegar al controlador', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/infrastructure-probe')
      .type('json')
      .send('{broken')
      .expect(400);
    expect(res.body.requestId).toBe(res.headers['x-correlation-id']);
    expect(res.body.statusCode).toBe(400);
  });
  it('aplica el límite global real y deja health disponible', async () => {
    for (let i = 0; i < 3; i++)
      await request(app.getHttpServer())
        .get('/api/v1/infrastructure-probe/limited')
        .expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/v1/infrastructure-probe/limited')
      .expect(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(res.body.requestId).toBe(res.headers['x-correlation-id']);
    expect(res.headers['retry-after']).toBeDefined();
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
  it('mantiene HEAD y preflight con correlation ID', async () => {
    await request(app.getHttpServer()).head('/api/v1/health').expect(200);
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'Content-Type,Authorization,X-Correlation-Id',
      )
      .expect(204);
    expect(res.headers['access-control-allow-headers']).toContain(
      'X-Correlation-Id',
    );
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});
