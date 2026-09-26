import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('API base (e2e)', () => {
  let app: INestApplication;
  const previousOrigins = process.env.CORS_ORIGINS;
  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173, http://localhost:4173';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    app.get(ConfigService).set('CORS_ORIGINS', process.env.CORS_ORIGINS);
    await configureApp(app);
  });
  afterAll(async () => {
    await app?.close();
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  });
  it('GET /api/v1/health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'maneja-de-una-api',
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp,
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('elimina la ruta del starter', () =>
    request(app.getHttpServer()).get('/').expect(404));
  it('publica Swagger UI', () =>
    request(app.getHttpServer())
      .get('/swagger')
      .expect(200)
      .expect(/swagger-ui/));
  it('documenta health con prefijo y esquema', async () => {
    const response = await request(app.getHttpServer())
      .get('/swagger-json')
      .expect(200);
    expect(response.body.info.title).toBe('Maneja de Una API');
    expect(
      response.body.paths['/api/v1/health'].get.responses['200'],
    ).toBeDefined();
    expect(
      response.body.components.schemas.HealthResponse.properties.timestamp
        .format,
    ).toBe('date-time');
  });
  it.each(['http://localhost:5173', 'http://localhost:4173'])(
    'permite CORS desde %s',
    async (origin) => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization,Content-Type')
        .expect(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      expect(response.headers['access-control-allow-headers']).toBe(
        'Content-Type,Authorization,X-Correlation-Id,X-Affiliate-Id,Idempotency-Key',
      );
    },
  );
  it('no autoriza orígenes ajenos', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://example.invalid');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
