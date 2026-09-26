import { config } from 'dotenv';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
config({ quiet: true });
if (process.env.NODE_ENV === 'production')
  throw new Error('Pruebas destructivas prohibidas en producción.');
const name = 'maneja_test_' + randomBytes(8).toString('hex');
const admin = new Client(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'postgres',
      },
);
let created = false;
try {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"');
  created = true;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_NAME: name,
    AUTH_MODE: 'local',
    AUTH_ISSUER: 'urn:autos:local',
    AUTH_AUDIENCE: 'autos-api',
    WEBHOOK_WORKER_ENABLED: 'false',
    WEBHOOK_ALLOW_LOOPBACK: 'true',
    SEED_ADMIN_EMAIL: 'admin@test.local',
    SEED_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
  };
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    url.pathname = '/' + name;
    env.DATABASE_URL = url.toString();
  }
  const commands = [
    ['dist/persistence/migrate.js'],
    ['dist/persistence/migrate.js', '--revert'],
    ['dist/persistence/migrate.js'],
    ['dist/persistence/seed.js'],
    [
      '--experimental-vm-modules',
      'node_modules/jest/bin/jest.js',
      '--config',
      'test/jest-e2e.json',
      '--runInBand',
    ],
  ];
  for (const args of commands) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  if (created) await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
  await admin.end();
}
