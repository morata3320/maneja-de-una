# Análisis verificable de contratos — RDA2 Semana 9

Fecha de auditoría: 2026-10-27. No se modificaron contratos, controladores, migraciones ni bases de datos.

## Fuentes localizadas

Los cinco archivos están fuera del repositorio, en `C:\Users\NW\Downloads`:

| Archivo | Líneas | SHA-256 |
|---|---:|---|
| `GUIA_INTEGRACION_AUTOS.md` | 269 | `c7a517cc5c7027a29dfc678513f2c58c93ee0b76ba7406ddecf3094d7a4de300` |
| `autos-openapi-v3.yaml` | 2137 | `d21f2b958f0318a68791bd7ff71c5fe0e89b852ddc3efc5b1f7d8931bac1d0ae` |
| `inventory.proto` | 148 | `e5a3661bd8897ab13a6368ac962b3ed8f253049951993d4d857ca95210434f31` |
| `microsevicios.txt` | 10037 | `9d5373570eb41120c40738adb14123b00df3a8ed59953c3f30500b30931b265c` |
| `base autos.txt` | 248 | `9d71f863bff01059876ea5e51c629525003bf09e0e9c110c05bd9df559e76db7` |

Ninguno fue copiado o alterado. La ruta que la guía menciona para `inventory.proto` pertenece a otro equipo/PC y no debe incorporarse literalmente.

## REST v3: las 19 operaciones

El documento declara OpenAPI `3.0.3`, API `3.0.0` y servidores `/api/v3`, producción `/api/v3`, local `/api/v3`, más aliases `/api/v2` y `/api/v1`.

| # | Operación v3 | Seguridad/headers relevantes | Estado actual en Maneja de Una |
|---:|---|---|---|
| 1 | GET `/autos/health` | pública | Existe sólo bajo `/api/v2/autos/health`; no `/api/v3` |
| 2 | GET `/autos/promociones/contrato` | Bearer o API key, correlation | Implementada en V2 |
| 3 | PUT `/autos/promociones/contrato` | auth, `Idempotency-Key`, correlation | Implementada V2; revisar idempotencia contractual |
| 4 | GET `/autos/eventos` | auth, cursor `after`, `limit` | Implementada V2 sobre `webhook_outbox` |
| 5 | GET `/autos` | pública, filtros | Implementada V2 |
| 6 | POST `/autos/search` | pública, 400/422/503 | Implementada V2; reglas 422 no equivalen completamente |
| 7 | GET `/autos/flota` | pública | Implementada V2 |
| 8 | GET `/autos/{id}/coberturas` | pública | Implementada V2 |
| 9 | GET `/autos/{id}` | pública | Implementada V2 |
| 10 | GET `/autos/orders` | auth | Implementada V2 |
| 11 | POST `/autos/orders/create` | auth, idempotencia, 201/409/422 | Implementada V2, DTO incompatible con v3 |
| 12 | POST `/autos/reservas` | alias canónico, mismos requisitos | Implementada V2, DTO incompatible con v3 |
| 13 | POST `/autos/reservas/{id}/checkin` | auth + idempotencia según contrato | Implementada V2 |
| 14 | POST `/autos/orders/{id}/checkin-entrega` | auth + idempotencia | Implementada V2 |
| 15 | POST `/autos/orders/{id}/checkin-devolucion` | auth + idempotencia | Implementada V2 |
| 16 | GET `/autos/orders/{orderId}` | auth | Implementada V2 |
| 17 | POST `/autos/orders/{orderId}/cancel` | auth + idempotencia | Implementada V2; reembolso es MOCK |
| 18 | POST `/autos/{id}/devolucion` | auth + idempotencia | Implementada V2 |
| 19 | POST `/autos/{id}/mantenimiento/registro` | roles mantenimiento/admin | Implementada V2 con scope verificado |

Las rutas son iguales entre los YAML V2 y V3; el diff estructural de `paths` es vacío. El cambio sustantivo está en el DTO de reserva y en el servidor base `/api/v3`.

## Diferencias exactas de reserva V2 → V3

El schema sigue llamándose `CreateAutoOrderRequestV2` dentro del archivo v3. Esto es una deuda nominal del contrato, no una licencia para renombrarlo.

| Aspecto | V2 | V3 | Impacto actual |
|---|---|---|---|
| Objeto canónico | `conductor` | `driver` | El DTO actual sólo declara `conductor`; `driver` es rechazado por whitelist |
| Required raíz | `vehicle_id`, `pickup_date`, `dropoff_date`, `conductor` | los mismos tres + `driver` | Incompatibilidad excluyente |
| Nombre | `nombre` | `full_name` | El DTO actual sólo acepta `nombre` opcional |
| Email | `email` | `email` | El DTO actual ni lo declara ni valida |
| Teléfono | `telefono` | `phone` | No soportado en DTO actual |
| Licencia | `licencia_conducir` | `license_number` | No soportado en DTO actual |
| País licencia | `pais_licencia` | `country_license`, default Ecuador | No soportado |
| Edad | variantes `edad`, `edad_conductor`, `driver_age`; no required | `age`, required, mínimo 18 | No soportado; 422 canónico no se garantiza |
| Vuelo | `numero_vuelo` | `flight_number` | No soportado |
| Horas | aliases españoles | añade `pickup_time`, `dropoff_time` | DTO actual sólo acepta `hora_recogida/devolucion` |
| Cobertura | `tipo_cobertura/cobertura`: BASICA/TOTAL/PREMIUM | añade `coverage_type`: BASIC/TOTAL/BASICA | `coverage_type` sería rechazado |
| Compatibilidad | español | inglés canónico + aliases españoles tolerados | Debe normalizarse en adaptador, no en dominio |
| Idempotencia | header; propiedad body deprecada | igual | Maneja de Una exige UUID v4, pero responde 409 si falta; validar código contractual esperado |

`AutoOrderResponseV2` no cambia estructuralmente entre ambos YAML. La guía, sin embargo, presenta como canónicos `vehicle_id`, `voucher_qr_payload` y `total_price` objeto; el schema OpenAPI conserva `auto_id`, `voucher_qr_data` y un `total_price` compatible con la definición previa. Esta contradicción debe resolverse por el equipo antes de implementar.

## Brechas funcionales de prioridad

1. El POST canónico inglés no funciona hoy por `forbidNonWhitelisted`.
2. `ConflictException` se normaliza actualmente sin código `VEHICLE_UNAVAILABLE`; la prioridad exige ese código exacto.
3. Fechas inválidas en creación generan 409 en el servicio actual; v3 exige 422 semántico.
4. El DTO actual hace opcionales todos los campos del conductor y no usa `@IsDefined()` para el objeto.
5. La creación responde 201 y produce PNR, pero el voucher sólo aparece en check-in digital, no necesariamente en la creación conforme al ejemplo de la guía.
6. `X-Correlation-Id` existe globalmente y llega al historial/outbox; falta una prueba v3 específica end-to-end.
7. No existe ruta `/api/v3`; sólo `/api/v2/autos`.

## Contrato gRPC oficial

Servicio: `inventory.InventoryStockService`, package `inventory`, proto3.

| RPC | Tipo | Entrada → salida | Semántica |
|---|---|---|---|
| `PushStockUpdate` | unary | `StockUpdateMessage` → `StockUpdateAck` | Snapshot puntual; para auto debe emitir `available_units` 1/0 |
| `StreamInventoryChanges` | client streaming | stream `StockChangeEvent` → `StreamSummary` | Deltas con `event_id`, `delta`, `slot_id` y hash final |
| `GetSlotAvailability` | unary | `SlotAvailabilityRequest` → `SlotAvailabilityResponse` | Reconciliación puntual contra Booking |

Campos comunes relevantes: `service_id`, `item_id`, `date`, `time_slot`, `timestamp`, `slot_id`. El ack agrega `error_code` y `current_available`. La regla monotónica del comentario indica descartar timestamps anteriores, pero no está expresada como constraint protocolar.

## Contradicciones contractuales/documentales

- El proto se autodescribe como vertical de Atracciones y usa ejemplos `NODE_ATR_*`, aunque la guía ordena reutilizarlo para Autos.
- La guía llama al canal “gRPC Inbound”, pero desde la tienda se implementa un cliente outbound hacia Booking.
- La guía prioriza `PushStockUpdate`; el entregable pide comparar tres RPC. No está decidido si los tres son obligatorios para cada tienda.
- El OpenAPI v3 conserva nombres de schemas `*V2` y no cambia las 19 rutas.
- La guía acepta alias españoles por Ley de Postel, mientras el required formal v3 exige `driver` inglés. Debe definirse si aliases son compatibilidad temporal o permanente.
- La guía muestra voucher en la respuesta de creación, mientras el schema de respuesta no fue modificado respecto de v2.
- V3 declara aliases `/api/v2` y `/api/v1`; no aclara duración ni política de deprecación.

## Decisión recomendada

Adoptar el YAML v3 sin editarlo y crear, tras aprobación, un adaptador `/api/v3/autos` que normalice inglés/español hacia un comando interno único. Mantener `/api/v2/autos` y `/autos/v1` como fachadas independientes durante la transición. No reutilizar DTOs HTTP como modelos de dominio ni mensajes gRPC.
