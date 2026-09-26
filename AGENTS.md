# Reglas del proyecto
- TypeScript solamente para código de aplicación y configuración ejecutable.
- Arquitectura actual: monolito modular; diseñar módulos desacoplados y escalables.
- Frontend React + TypeScript + Vite. Backend NestJS + TypeScript.
- API interna REST + JSON en /api/v1; integracion contractual en /autos/v1. Swagger/OpenAPI obligatorio.
- Frontend nunca accede directamente a BD. Booking futuro consume APIs, no BD.
- Persistencia aprobada: PostgreSQL 16 + TypeORM, entidades separadas del dominio y migraciones; synchronize siempre false.
- No introducir todavía microservicios, API Gateway, gRPC, GraphQL, RabbitMQ/Kafka ni WebSockets.
- No romper contratos existentes. Implementar contracts/autos-openapi.yaml del commit 090e863928579bf90eb21c560b798114bafb2028 sin editarlo; verificar su SHA-256. DTOs y rutas deben adaptarse al contrato.
- No añadir telemetría externa ni despliegue automático sin solicitarlo.

