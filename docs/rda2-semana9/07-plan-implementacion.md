# Plan de implementación posterior a aprobación

Estado actual: **Paso 0 completo en documentación; migración física no autorizada**.

## Fase 0 — aprobación común

Entregables del equipo:

1. OpenAPI v3 definitivo con hash y ejemplos coherentes con schemas.
2. Proto definitivo con endpoint, TLS, metadata y obligatoriedad de los tres RPC.
3. SQL maestro corregido, ownership tabla/servicio y política de IDs.
4. Matriz de errores 400/401/403/409/422/503.
5. Minuta que resuelva las preguntas del documento 06.

Gate: aprobación explícita del equipo Autos. Sin gate no se modifica ningún controlador ni DB.

## Fase 1 — contract tests antes de implementación

- Versionar copias inmutables aprobadas bajo `contracts/` y `src/proto/`.
- Añadir verificación SHA-256 y parse OpenAPI/Protobuf.
- Generar casos consumer-driven para las 19 operaciones.
- Agregar tests rojos para `driver` inglés, 201, 409 `VEHICLE_UNAVAILABLE`, 422, idempotencia y correlation.
- Mantener tests de `/autos/v1` y `/api/v2` como regresión.

Rollback: retirar sólo tests/artefactos nuevos; ningún dato afectado.

## Fase 2 — fachada v3 dentro del monolito

- Crear adapter v3 sólo después de aprobación.
- Normalizar `driver`/aliases y coverage en una capa anti-corrupción.
- Introducir comandos internos independientes de HTTP.
- Mapear errores a RFC 7807 exacto.
- Servir v3, mantener v2/v1 y añadir headers de deprecación cuando se acuerde.
- No duplicar lógica de disponibilidad/reserva.

Gate: 19 operaciones pasan contra OpenAPI v3 y no hay regresión frontend.

## Fase 3 — límites lógicos de dominio

- Definir interfaces `IdentityPort`, `CatalogPort`, `InventoryPort`, `OrderPort`, `CounterPort`, `MaintenancePort`, `PricingPort`, `PaymentsPort`.
- Mover SQL detrás de repositorios del owner lógico.
- Prohibir nuevos joins cross-domain mediante revisión/lint arquitectónico.
- Mantener un único proceso y una base mientras se mide paridad.

Gate: comportamiento idéntico con adaptadores in-process.

## Fase 4 — gRPC stock con outbox

- Generar cliente desde el proto aprobado, sin editarlo.
- Variables: URL, TLS, CA/SNI, node ID, deadlines y retry policy; sin defaults de RodadoEc.
- Crear outbox de sincronización por cambio confirmado de Inventory.
- `available_units=1` sólo si la unidad está operativa y libre para slot; `0` para reservada, entregada, limpieza o mantenimiento.
- Deduplicar por event/slot y timestamp monotónico.
- Implementar reconciliación con `GetSlotAvailability` sólo si el equipo lo exige.

Tests: servidor gRPC fake local, timeout, retry, stale timestamp, caída Booking, replay y orden de eventos.

## Fase 5 — schemas sombra y migraciones reversibles

Sólo PostgreSQL local/staging:

- Crear schemas/bases objetivo sin tocar tablas legacy.
- Añadir `legacy_id`/mapping tables privados durante backfill.
- Copiar datos con scripts idempotentes y checkpoints.
- Ejecutar validaciones del documento 04.
- Diseñar `down` que retire únicamente estructuras sombra.

Prohibido: ejecutar en Azure sin backup probado y autorización escrita.

## Fase 6 — extracción progresiva

Orden recomendado por riesgo:

1. Catalog read-only.
2. Pricing/promotions read-only.
3. Identity con compatibilidad JWT.
4. Maintenance.
5. Counter.
6. Payments.
7. Inventory — alto riesgo por concurrencia.
8. Order — último core transaccional.

Cada extracción requiere health, metrics/logs seguros, timeout, circuit breaker, retry idempotente, ownership DB y ruta de rollback al monolito.

## Fase 7 — pruebas Tailscale

- Crear tailnet/ACL específica de integración; no usar cuentas personales compartidas.
- Exponer Gateway REST y endpoint gRPC sólo a nodos aprobados.
- Probar DNS, TLS, MTU, reconnect, latencia y cold starts.
- Ejecutar reserva desde Booking, verificar PNR/voucher, evento stock 0, cancelación/stock 1, devolución/cooldown y mantenimiento.
- Registrar correlation ID extremo a extremo sin PII.

## Fase 8 — staging y Azure

- Backup y restauración ensayada.
- Deploy dark sin tráfico.
- Backfill, parity read, canary y dual-write mediante flags.
- Reconciliación y observación durante ventana acordada.
- Cutover por dominio, nunca big-bang.
- No eliminar legacy hasta cerrar una ventana estable y auditable.

## Suite mínima de aceptación

| Escenario | Resultado esperado |
|---|---|
| POST v3 inglés válido | 201, PNR y voucher según contrato aprobado |
| Dos reservas simultáneas | una 201, otra 409 `VEHICLE_UNAVAILABLE` |
| Mismo Idempotency-Key/mismo body | replay idéntico |
| Misma key/body distinto | error aprobado, sin segunda orden |
| Edad <18 | 422 |
| Fechas inválidas | 422 |
| Correlation recibido/generado | mismo ID en response, history y outbox |
| Reserva/cancelación | stock gRPC 0/1 |
| Devolución | cooldown exacto 120 min y stock 0 |
| Fin cooldown sin maintenance | stock 1 |
| Fin cooldown con maintenance | sigue 0 |
| Odómetro decreciente | rechazado |
| Rol cliente en mantenimiento | 403 |
| Booking gRPC caído | reserva consistente, evento reintentable |
| V1/V2/frontend | regresión completa PASS |

## Comandos seguros durante Paso 0

Sólo validación estática/local, sin migraciones:

```powershell
cd apps/api
npm run lint
npm run build
npm test
npm run test:contract

cd ../web
npm run lint
npm run build
```

No ejecutar `migration:run`, `test:e2e` (crea una base temporal), despliegues ni comandos Azure hasta aprobación.
