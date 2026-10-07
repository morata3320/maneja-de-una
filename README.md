# Maneja de Una

## Descripción

Marketplace de alquiler de vehículos construido como monolito modular. La experiencia pública permite buscar, comparar, guardar favoritos, reservar y completar un pago simulado; el panel ADMIN gestiona la operación mediante API V2 real.

## Arquitectura y stack

- React 19 + TypeScript + Vite. Frontend MVC pragmático en `models`, `controllers`, `views`, `services` y `components`.
- NestJS + TypeScript. Capas Controller, Service, DTO, Guard/Filter y persistencia.
- PostgreSQL 16 + TypeORM, entidades separadas, migraciones y `synchronize=false`.
- REST + JSON, OpenAPI/Swagger, JWT y bcrypt.

## API REST V2 y versionamiento

`/api/v2` expone Auth, Users, Vehicles, Brands, Vehicle Models, Categories, Locations, Suppliers, Depots, Depot Scores, Favorites, Reservations, Payments, Admin y Health. `/api/v1`, `/autos/v1` y `/swagger/autos` se conservan por compatibilidad. El detalle de vehículo incluye enlaces HATEOAS `self`, `update`, `delete` y `reserve`.

El frontend centraliza toda comunicación en `services/apiClient.ts`. El flujo principal es Home → Catálogo → Detalle → Registro/Login → Reserva → Datos → Pago simulado → Confirmación. El backend calcula el importe y evita solapamientos mediante transacción y bloqueo; el frontend nunca es fuente de verdad del total.

## JWT, roles y seguridad

JWT contiene `sub`, email y rol, y expira mediante `JWT_EXPIRES_IN`. El registro público siempre crea `USER`; solo un ADMIN puede crear otro ADMIN. 401 representa autenticación ausente o inválida y 403 permisos insuficientes. Las contraseñas usan bcrypt y nunca se devuelven. Helmet, rate limiting, CORS explícito, validación DTO con whitelist y SQL parametrizado cubren controles OWASP principales.

La cédula ecuatoriana valida 10 dígitos, provincia 01–24, tercer dígito, repeticiones y checksum Mod10. No consulta Registro Civil ni afirma existencia de una persona.

## Pago simulado

No procesa dinero ni consulta bancos. El número solo se valida por formato y longitud; además se validan titular, expiración y CVV. Solo persiste referencia, reserva, usuario, importe calculado, moneda, estado, método, marca y últimos cuatro dígitos. Nunca almacena, registra ni responde PAN completo, CVV/CVC, PIN o expiración. El frontend tampoco guarda esos datos en almacenamiento web.

## Modelo de datos y persistencia

Users representa clientes y administradores; Orders representa reservas, sin tablas duplicadas. Los catálogos alimentan Vehicles, Favorites relaciona usuarios y vehículos, y Payments conserva únicamente datos no sensibles. Toda evolución usa migraciones TypeORM; `synchronize` permanece desactivado. El seed es local, idempotente y se niega a ejecutar en producción.

## API-first y Swagger

`/swagger` documenta V2 y permite autorizar Bearer JWT. `/swagger/autos` expone el contrato externo `/autos/v1`. `contracts/autos-openapi.yaml` permanece inmutable y su SHA-256 canónico se verifica en tests. `contracts/maneja-de-una-v2-openapi.yaml` describe el marketplace. Booking futuro consumirá APIs y nunca la base de datos.

## Ejecución local

Requiere Node 24 y PostgreSQL 16.

1. Copiar `.env.example` y `apps/api/.env.example` a archivos `.env` locales, completar valores seguros y ejecutar `docker compose up -d`.
2. En `apps/api`: `npm ci`, `npm run migration:run`, `npm run seed`, `npm run start:dev`.
3. En `apps/web`: `npm ci`, copiar `.env.example` si hace falta y ejecutar `npm run dev`.

Web: `http://localhost:5173`. Health V2: `http://localhost:3000/api/v2/health`. Swagger: `http://localhost:3000/swagger`. Swagger Autos: `http://localhost:3000/swagger/autos`.

`CORS_ORIGINS` acepta orígenes separados por comas, nunca comodín en producción. `VITE_API_URL` es la base completa de V2 y se incorpora al compilar. Los `.env` son locales y no se versionan.

## Tests

En `apps/api`: `npm run lint`, `npm run contract:check`, `npm run test:contract`, `npm run build`, `npm test -- --runInBand` y `npm run test:e2e`. E2E crea y elimina únicamente una base aislada. En `apps/web`: `npm run lint` y `npm run build`.

## CI/CD, Render y Azure PostgreSQL

GitHub Actions ejecuta todas las comprobaciones en push y pull request a `main` con PostgreSQL 16 aislado, nunca Azure productivo. `render.yaml` define el backend y el sitio estático; `autoDeployTrigger: checksPass` espera CI verde. `npm run start:render` aplica migraciones, crea de forma idempotente el ADMIN configurado mediante `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, y después inicia NestJS. Nunca promueve un USER existente ni ejecuta el seed completo. Azure conserva la base y solo admite los rangos salientes del backend Render. Ver `docs/RENDER_DEPLOY.md` y `docs/DEFENSA.md`.

## URLs de producción esperadas

- Web: `https://maneja-de-una-web-mdu.onrender.com`
- API health: `https://maneja-de-una-api-mdu.onrender.com/api/v2/health`
- Swagger: `https://maneja-de-una-api-mdu.onrender.com/swagger`
- Swagger Autos: `https://maneja-de-una-api-mdu.onrender.com/swagger/autos`

## Limitaciones y trabajo futuro

Los pagos son exclusivamente simulados y las imágenes son ilustrativas. No existe integración bancaria ni validación de identidad civil. Actualmente no se usa GraphQL, gRPC, SOAP, microservicios, API Gateway, Kafka, RabbitMQ ni WebSockets; solo se evaluarían en una evolución justificada por escala o integración.
