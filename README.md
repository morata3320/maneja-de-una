# Maneja de Una

Marketplace de alquiler de vehículos. Es un monolito modular en TypeScript con API NestJS, frontend React + Vite y persistencia PostgreSQL 16 mediante TypeORM.

## Desarrollo
Node local: 24.19.0 (ver .nvmrc); CI: Node 24. Ejecutar desde cada aplicación:

- Base: copiar `.env.example` a `.env`, definir una contraseña local y ejecutar `docker compose up -d`.
- API: `cd apps/api`, `npm ci`, copiar `.env.example` a `.env`, usar la misma configuración de base y ejecutar `npm run migration:run`, `npm run seed` y `npm run start:dev`.
- Web, en otra terminal: `cd apps/web`, `npm ci`, copiar `.env.example` a `.env` si falta y `npm run dev`.

Web: http://localhost:5173. Health: http://localhost:3000/api/v1/health.
Swagger interno: http://localhost:3000/swagger. Contrato Autos servido sin modificaciones: http://localhost:3000/swagger/autos.

La web solo muestra una comprobación de conexión. El cliente central está en apps/web/src/api/http.ts.
CORS_ORIGINS acepta orígenes separados por comas (sin comodín). VITE_API_URL define la URL de la API y se incorpora al compilar el frontend. Las variables VITE_ son públicas.
Los archivos .env son locales; .env.example sí se versionan.

## Comprobaciones
En apps/api: `npm run lint`, `npm run contract:check`, `npm run test:contract`, `npm run build`, `npm test -- --runInBand` y `npm run test:e2e`. La última orden crea una base aislada, ejecuta migración y seed, corre las pruebas y elimina únicamente esa base temporal.
En apps/web: `npm run build`.
CI ejecuta estas comprobaciones en push y PR hacia main. No hay deploy automático.
API de producción: `npm run start:prod`, escucha en 0.0.0.0 con PORT (3000 por defecto).

## Alcance
La API contractual implementa las 15 operaciones de `contracts/autos-openapi.yaml` en `/autos/v1`, con validación directa desde sus esquemas, OAuth/JWKS para producción, idempotencia, bloqueo transaccional de inventario y webhooks persistentes. El SHA-256 canónico se verifica en cada comprobación de contrato.

La API interna conserva `/api/v1` e incluye autenticación propia, favoritos y administración paginada de catálogo. Las credenciales internas y externas son deliberadamente incompatibles. Las dos superficies se documentan por separado.

La persistencia usa migraciones con `synchronize: false`, seed determinista local y un outbox para webhooks. La guía de PostgreSQL está en `docs/architecture/postgresql-local.md` y el diseño backend en `docs/architecture/backend.md`.
Booking consumirá APIs, nunca la base de datos.
Reglas en AGENTS.md y procedencia contractual en `contracts/README.md`. No hay despliegue automático.

