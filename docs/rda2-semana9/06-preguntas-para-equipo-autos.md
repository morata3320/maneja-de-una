# Decisiones que debe aprobar el equipo de Autos

No iniciar migración física hasta responder y registrar estas decisiones.

## Contrato REST

1. ¿La base pública obligatoria es `/api/v3`, se exige también `/api/v3/autos`, y cuánto tiempo vivirán `/api/v2` y `/api/v1`?
2. ¿El schema debe renombrarse a `CreateAutoOrderRequestV3` o se conserva literalmente el nombre `...V2` del YAML v3?
3. ¿`driver` inglés es estrictamente required y `conductor` sólo compatibilidad, o ambos son alternativas formalmente válidas?
4. ¿Qué estructura exacta debe devolver 201: la del schema OpenAPI sin cambios o el ejemplo de la guía con `vehicle_id`, `voucher_qr_payload` y `total_price` objeto?
5. ¿`coverage_type` admite `BASIC`, `BASICA`, `TOTAL` y `PREMIUM`? El enum v3 no incluye PREMIUM en inglés pero mantiene alias español.
6. ¿Falta de `Idempotency-Key` es 400, 409 o 422? ¿Reutilización con otro body usa `IDEMPOTENCY_CONFLICT`?
7. ¿Toda indisponibilidad (reserva, hold, limpieza, mantenimiento, estado) devuelve exactamente 409 `VEHICLE_UNAVAILABLE`?
8. ¿Qué validaciones son 400 de forma versus 422 semántico? Confirmar menor de edad y fechas.
9. ¿El voucher debe generarse al crear reserva o al check-in digital?
10. ¿Los 19 endpoints protegidos aceptan alternativamente Bearer y `X-API-Key`? Definir scopes/roles por operación.

## gRPC

11. ¿Los tres RPC son obligatorios para cada tienda o sólo `PushStockUpdate`?
12. ¿El endpoint oficial es `rda1-backend-integracion-sistemas.onrender.com:50051`, `booking.epn.edu.ec:50051` u otro?
13. ¿Se usa TLS en nube y plaintext sólo en Tailscale/local? Entregar CA/SNI esperados.
14. Para un auto físico, ¿`item_id` es UUID, `vehicle_id` público o placa? Recomendación: ID público inmutable, nunca placa mutable.
15. ¿Cómo se construye `slot_id` para alquileres multi-día y franjas de 30 minutos?
16. ¿Debe enviarse un snapshot 1/0 por cada slot del intervalo o sólo por fecha/hora de recogida?
17. ¿Cómo se reintenta un `STALE_TIMESTAMP_IGNORED` y cuál reloj es autoridad?
18. ¿`StreamInventoryChanges` usa delta por auto físico o por stock agregado de modelo?
19. ¿`GetSlotAvailability` es reconciliación obligatoria antes de confirmar o tarea periódica?
20. ¿Qué autenticación/autorización usa gRPC? El proto no define metadata.

## Datos y ownership

21. ¿Database-per-Service significa bases físicas, schemas en una base o ambos por etapas?
22. ¿Se aprueban siete dominios o los cuatro procesos RodadoEc? Definir dueño de cada tabla.
23. ¿`ms_catalog` o `ms_inventory` es dueño de `vehicles`? Recomendación: Catalog define modelo; Inventory define unidad física.
24. ¿Dónde viven depots/suppliers/locations: Catalog o Inventory?
25. ¿`maintenance_log` pertenece a Catalog como RodadoEc o a `ms_maintenance` como la guía?
26. ¿Promociones pertenecen a Order/Booking o Pricing?
27. ¿Counter es servicio independiente o módulo temporal de Order?
28. ¿Se mantienen brands/models/categories normalizados o se acepta duplicar make/model/type por unidad?
29. ¿Cuál es el ID público compartido y cómo se mapea desde UUID actuales sin cambiar favoritos/reservas?
30. ¿Se aprueba mantener placa, año, color, combustible, descripción, geolocalización y soft-delete, ausentes del maestro?
31. ¿Se mantienen holds, previews e idempotency records, ausentes del maestro?
32. ¿Cómo se preservan favoritos en la arquitectura objetivo?
33. ¿Se aprueba `rental_inspections` y status history, ausentes del maestro?
34. ¿Estado de reserva y estado operativo del vehículo son enums distintos? Deben serlo.
35. ¿El score admite 10.00? `numeric(3,2)` del maestro no lo permite.
36. ¿El default de promociones es false/0 o true/15? Las fuentes contradicen.
37. ¿Admins viven sólo en entorno, sólo en DB o ambos? Definir bootstrap y rotación.

## Operación, seguridad y despliegue

38. ¿Se autoriza usar código RodadoEc o sólo contratos/modelo? Definir licencia y ownership académico.
39. ¿Se prohíben explícitamente los secretos/defaults de RodadoEc en cualquier entorno compartido?
40. ¿Tailscale es sólo red de prueba o requisito de producción? Definir tailnet, ACLs, MagicDNS y responsables.
41. ¿Qué SLO y timeout aplican? La guía habla de 4–5 s; RodadoEc eleva 60 s por cold starts.
42. ¿RabbitMQ, Kafka o uno solo? ¿Qué eventos, exchange/topic, DLQ y retención?
43. ¿GraphQL entra en Semana 9 o queda fuera del mínimo de integración?
44. ¿Qué evidencia exige la cátedra: logs físicos, dashboard verde, capturas, pruebas contractuales o trazas distribuidas?
45. ¿Cuál es la ventana de cutover y quién autoriza migraciones Azure?

## Criterio de aprobación sugerido

El equipo debe producir una minuta versionada con: contrato y hash; tabla de ownership; SQL corregido; IDs; enums; errores; autenticación; topología; estrategia de rollback y responsables. Sin esa minuta, el estado permanece **NO APROBADO PARA MIGRACIÓN FÍSICA**.
