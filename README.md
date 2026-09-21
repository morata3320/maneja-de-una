# Maneja de Una

Base de un marketplace de alquiler de vehículos. Monolito modular con API REST NestJS y frontend React + Vite, ambos en TypeScript. Base de datos aún no definida.

## Desarrollo
Node local: 24.19.0 (ver .nvmrc); CI: Node 24. Ejecutar desde cada aplicación:

- API: `cd apps/api`, `npm ci`, copiar `.env.example` a `.env` si falta y `npm run start:dev`.
- Web, en otra terminal: `cd apps/web`, `npm ci`, copiar `.env.example` a `.env` si falta y `npm run dev`.

Web: http://localhost:5173. Health: http://localhost:3000/api/v1/health.
Swagger: http://localhost:3000/swagger. OpenAPI JSON: http://localhost:3000/swagger-json.

La web solo muestra una comprobación de conexión. El cliente central está en apps/web/src/api/http.ts.
CORS_ORIGINS acepta orígenes separados por comas (sin comodín). VITE_API_URL define la URL de la API y se incorpora al compilar el frontend. Las variables VITE_ son públicas.
Los archivos .env son locales; .env.example sí se versionan.

## Comprobaciones
En apps/api: `npm run build`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`.
En apps/web: `npm run build`.
CI ejecuta estas comprobaciones en push y PR hacia main. No hay deploy automático.
API de producción: `npm run start:prod`, escucha en 0.0.0.0 con PORT (3000 por defecto).

## Alcance
Sin dominio, autenticación, base de datos ni servicios externos todavía.
Esperar el contrato API-first antes de implementar catálogo, reservas o Booking.
Booking consumirá APIs, nunca la base de datos.
Reglas en AGENTS.md; documentación futura en docs/architecture y docs/contracts.

