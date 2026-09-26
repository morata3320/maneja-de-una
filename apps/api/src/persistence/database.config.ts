import type { DataSourceOptions } from 'typeorm';
import { validateBackendEnvironment } from '../config/backend-environment';
import { entities } from './entities';
import { InitialSchema1790200000000 } from './migrations/1790200000000-initial-schema';
export function databaseOptions(): DataSourceOptions {
  validateBackendEnvironment(process.env);
  const port = Number(process.env.DB_PORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('DB_PORT inválido.');
  if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD)
    throw new Error('Configurar DB_PASSWORD o DATABASE_URL.');
  return {
    type: 'postgres',
    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST ?? '127.0.0.1',
          port,
          database: process.env.DB_NAME ?? 'maneja_de_una',
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD,
        }),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    entities,
    migrations: [InitialSchema1790200000000],
    synchronize: false,
    logging: false,
  };
}
