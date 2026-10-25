# Eventos y outbox

Los cambios críticos insertan eventos en `webhook_outbox` dentro de la misma transacción PostgreSQL:

- `AUTO_ORDER_CONFIRMED`
- `AUTO_ORDER_CANCELLED`
- `AUTO_CLEANING_COOLDOWN_STARTED`
- `AUTO_MAINTENANCE_ALERT`

`GET /api/v2/autos/eventos` los expone como CloudEvents 1.0. El worker HTTP existente conserva reintentos persistentes por suscripción.

RabbitMQ, exchanges y DLQ están PENDIENTES debido a la restricción actual de no introducir broker. La outbox evita acoplar la consistencia del dominio a esa decisión futura.
