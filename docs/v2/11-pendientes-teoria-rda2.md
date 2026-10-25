# Pendientes RDA2

| Componente | Estado | Motivo |
|---|---|---|
| REST Autos V2 | IMPLEMENTADO / PROBADO | 19 operaciones disponibles |
| Estados, check-in y cooldown | IMPLEMENTADO / PROBADO | Persistencia y transacciones reales |
| Mantenimiento | IMPLEMENTADO / PROBADO | RBAC por credenciales |
| Outbox/CloudEvents | IMPLEMENTADO / PROBADO | Feed y persistencia reales |
| Reembolso financiero | PARCIAL | Sólo referencia MOCK, sin pasarela |
| gRPC stock | BLOQUEADO | Restricción del repositorio y destino Booking no verificado |
| SOAP pagos | BLOQUEADO | Restricción del repositorio y sin pasarela |
| RabbitMQ/DLQ | BLOQUEADO | Restricción del repositorio e infraestructura ausente |
| GraphQL | BLOQUEADO | Restricción del repositorio |
| Gateway/ESB/Saga distribuida | PENDIENTE | Arquitectura actual es monolito modular |
| 13 microservicios desplegados | PENDIENTE | Requiere decisión de arquitectura e infraestructura |
| Frontend operativo RDA2 ampliado | PENDIENTE | Este bloque priorizó el contrato e invariantes backend |

La siguiente fase segura es generar pruebas contractuales automáticas directamente desde `autos-openapi-v2.yaml`, completar vistas operativas del frontend y, con autorización expresa, implementar el cliente gRPC de stock.
