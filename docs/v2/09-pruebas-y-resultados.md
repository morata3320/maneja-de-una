# Pruebas y resultados

Ejecución local contra PostgreSQL 16 el 2026-10-25:

| Prueba | Resultado |
|---|---|
| Build backend | PASS |
| Lint backend | PASS |
| Migración `up/down/up` | PASS |
| Unitarias + E2E existentes | PASS |
| Suite total E2E | PASS, 61/61 |
| Presencia de 19 operaciones en Swagger | PASS |
| Idempotencia de creación | PASS |
| Reserva solapada | PASS, HTTP 409 |
| Check-in, entrega, devolución y cooldown | PASS |
| Promociones y RBAC | PASS |
| Mantenimiento y outbox | PASS |

No ejecutado: gRPC, SOAP, RabbitMQ, GraphQL ni pruebas contra Azure/Booking, porque esos componentes no están implementados o no existe autorización/infraestructura disponible.
