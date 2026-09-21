import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import type { Response } from 'express';
import type { CorrelatedRequest } from './common/types/request-context';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

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
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
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
    .setDescription(
      'API REST del marketplace de alquiler de vehículos Maneja de Una',
    )
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup(
    'swagger',
    app,
    SwaggerModule.createDocument(app, config),
  );
  await app.init();
  // Nest 12 limita su fallback 404 al prefijo; uniformar también rutas externas.
  app.use((req: CorrelatedRequest, res: Response) => {
    exceptionFilter.respond(new NotFoundException(), req, res);
  });
}
