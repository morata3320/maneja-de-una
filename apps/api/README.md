# Maneja de Una API

NestJS + TypeScript; monolito modular. Instrucciones de ejecución en ../../README.md.
Arquitectura y convenciones: [backend](../../docs/architecture/backend.md).

- Health: GET /api/v1/health, sin BD.
- Swagger: /swagger. OpenAPI: /swagger-json.
- Entorno local: copiar .env.example a .env. La configuración inválida impide arrancar.
- Límite: RATE_LIMIT_MAX=100 por RATE_LIMIT_TTL_MS=60000, por IP y endpoint; health exento.
- Respuestas incluyen X-Correlation-Id; errores incluyen requestId.
- Sin BD, autenticación funcional ni telemetría externa.

Validar con npm run lint, npm run build, npm test -- --runInBand y npm run test:e2e -- --runInBand.

