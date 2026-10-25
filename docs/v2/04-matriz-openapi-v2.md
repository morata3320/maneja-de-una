# Matriz OpenAPI Autos V2

| Operación | Estado |
|---|---|
| GET `/autos/health` | IMPLEMENTADO / PROBADO |
| GET, PUT `/autos/promociones/contrato` | IMPLEMENTADO / PROBADO |
| GET `/autos/eventos` | IMPLEMENTADO / PROBADO |
| GET `/autos`, POST `/autos/search` | IMPLEMENTADO / PROBADO |
| GET `/autos/flota` | IMPLEMENTADO / PROBADO |
| GET `/autos/{id}`, `/autos/{id}/coberturas` | IMPLEMENTADO / PROBADO |
| GET `/autos/orders`, `/autos/orders/{orderId}` | IMPLEMENTADO / PROBADO |
| POST `/autos/orders/create`, `/autos/reservas` | IMPLEMENTADO / PROBADO |
| POST check-in digital, entrega y devolución | IMPLEMENTADO / PROBADO |
| POST cancelación | IMPLEMENTADO / PROBADO; reembolso MOCK |
| POST devolución por vehículo | IMPLEMENTADO |
| POST mantenimiento | IMPLEMENTADO / PROBADO |

Base canónica: `/api/v2`. El documento fuente se conserva en `contracts/autos-openapi-v2.yaml`.
