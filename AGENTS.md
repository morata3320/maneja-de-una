# Reglas del proyecto
- TypeScript solamente para código de aplicación y configuración ejecutable.
- Arquitectura actual: monolito modular; diseñar módulos desacoplados y escalables.
- Frontend React + TypeScript + Vite. Backend NestJS + TypeScript.
- API REST + JSON versionada en /api/v1. Swagger/OpenAPI obligatorio.
- Frontend nunca accede directamente a BD. Booking futuro consume APIs, no BD.
- Base de datos aún no definida: no instalar motores ni ORM.
- No introducir todavía microservicios, API Gateway, gRPC, GraphQL, RabbitMQ/Kafka ni WebSockets.
- No romper contratos existentes. El dominio preliminar puro está autorizado; esperar el contrato API-first antes de crear controllers, DTO HTTP o endpoints de negocio.
- No añadir telemetría externa ni despliegue automático sin solicitarlo.

