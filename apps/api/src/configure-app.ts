import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import type { Response } from 'express';
import type { CorrelatedRequest } from './common/types/request-context';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { autosDocument } from './integrations/autos/contract/contract-document';
import type { OpenAPIObject } from '@nestjs/swagger';
import { V2Module } from './v2/v2.module';
import { HealthModule } from './health/health.module';

export async function configureApp(app: INestApplication): Promise<void> {
  const origins = app
    .get(ConfigService)
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.includes('*'))
    throw new Error(
      'CORS_ORIGINS requiere orígenes explícitos, sin comodines.',
    );
  app.use(requestContextMiddleware);
  app.use(helmet());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'autos/v1/{*path}', method: RequestMethod.ALL },
      { path: 'api/v2/{*path}', method: RequestMethod.ALL },
    ],
  });
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Affiliate-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Correlation-Id'],
  });
  app.use(
    json({ type: ['application/json', 'application/*+json'], limit: '100kb' }),
  );
  const exceptionFilter = new GlobalExceptionFilter();
  app.useGlobalFilters(exceptionFilter);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('Maneja de Una API')
    .setDescription('Marketplace REST de alquiler de vehículos.')
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Vehicles')
    .addTag('Brands')
    .addTag('Vehicle Models')
    .addTag('Categories')
    .addTag('Locations')
    .addTag('Suppliers')
    .addTag('Depots')
    .addTag('Depot Scores')
    .addTag('Users')
    .addTag('Favorites')
    .addTag('Reservations')
    .addTag('Payments')
    .addTag('Admin')
    .addTag('Health')
    .build();
  SwaggerModule.setup(
    'swagger',
    app,
    SwaggerModule.createDocument(app, config, {
      include: [V2Module, HealthModule],
    }),
  );
  SwaggerModule.setup(
    'swagger/autos',
    app,
    autosDocument as unknown as OpenAPIObject,
  );
  await app.init();
  // Nest 12 limita su fallback 404 al prefijo; uniformar también rutas externas.
  app.use((req: CorrelatedRequest, res: Response) => {
    exceptionFilter.respond(new NotFoundException(), req, res);
  });
}
