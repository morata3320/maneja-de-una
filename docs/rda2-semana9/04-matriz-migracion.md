# Matriz de migración funcional y técnica

Leyenda: **C** conservar, **A** adaptar, **S** separar, **E** eliminar sólo después de verificación, **I** implementar.

| Capacidad/artefacto actual | Acción | Destino | Condición de aceptación |
|---|---:|---|---|
| `/autos/v1` contrato de 15 operaciones | C | Gateway legacy | Hash y contract tests sin cambios |
| `/api/v2` marketplace web | C | Gateway/API interna | Frontend y admin sin regresiones |
| `/api/v2/autos` 19 operaciones | A | futura fachada `/api/v3/autos` | DTO inglés, errores y headers v3 conformes |
| `CreateAutoOrderV2Dto` actual | A | adapter v3 | `driver` canónico + aliases, 422 semántico |
| `AutosV2Service.createOrder` | S | Order + Inventory + Pricing | Sin SQL cruzado y con compensación idempotente |
| `AuthService`, guards, JWT separados | C/A | Identity + Gateway | Roles CLIENTE/ADMIN/MANTENIMIENTO aprobados |
| `vehicles` unidad física | C/S | Inventory | ID público estable y placa preservada |
| brands/models/categories/media | S | Catalog | Mapping externo versionado |
| disponibilidad por intervalos | C/S | Inventory | Misma protección concurrente y pruebas race |
| holds y previews | C/S | Inventory / Order | TTL, ownership e idempotencia definidos |
| stock agregado por modelo | C/A | Inventory query model | No confundir con `available_units` físico 1/0 |
| orders/PNR/snapshots | C/S | Order | PNR único y datos históricos completos |
| check-in/entrega/devolución | S | Counter | FSM aprobada y comandos idempotentes |
| inspections | C/S | Counter | Odómetro/fuel/agent auditables |
| cooldown table | C/S | Inventory | 120 min, no reactivar si mantenimiento pendiente |
| maintenance records | C/S | Maintenance | IDs lógicos; consulta de odómetro oficial |
| coverage plans y pricing domain | S | Pricing | BASIC/BASICA/TOTAL/PREMIUM resueltos |
| promotion agreements | S | Pricing/Promotions | default y singleton aprobados |
| payments mock | C/S | Payments | MOCK visible; no PAN/CVV |
| favorites | C | Servicio futuro o Catalog facade | Funcionalidad web no se pierde |
| outbox + webhook attempts | C/A | owner por dominio + relay | CloudEvents, retries y dedupe preservados |
| webhooks cifrados | C | Order/Notifications | Nunca migrar secreto en plaintext |
| idempotency records | C/S | Gateway/servicio dueño | Replays conservan status/body/fingerprint |
| React/Vite e identidad visual | C | Frontend Maneja de Una | Sin sustitución por UI RodadoEc |
| SQL directo cross-domain | E gradual | interfaces/clients | Sólo después de parity tests |
| FKs cross-domain | E gradual | IDs lógicos + validación API | Después de backfill y reconciliación |
| cliente gRPC stock | I | Inventory | Proto exacto, TLS configurable, outbox/retry |
| `GetSlotAvailability` reconciliación | I si obligatorio | Inventory | Decisión del equipo y prueba de drift |
| Tailscale | I para pruebas, no dependencia runtime | entorno integración | ACL, DNS, certificados y owners aprobados |

## Fases y puertas de control

| Fase | Escritura permitida | Evidencia para avanzar | Rollback |
|---|---|---|---|
| 0 Alineación | sólo docs | SQL/ownership/contratos firmados | descartar propuesta |
| 1 Seams internos | código sin mover datos | contract/unit tests | revert commit |
| 2 Esquemas sombra locales | DB local únicamente | migración up/down, conteos/checksums | down migration |
| 3 Backfill local | targets sombra | 100% filas mapeadas y excepciones cero/aprobadas | truncar sólo schemas sombra |
| 4 Dual-read | producción detrás de flag | parity logs sin PII | flag a legacy |
| 5 Dual-write/outbox | producción gradual | lag/retries/consistencia medidos | flag y replay outbox |
| 6 Cutover por dominio | servicio por servicio | SLO y reconciliación | routing al monolito |
| 7 Retiro legacy | ninguna eliminación inmediata | ventana estable + backup restaurable | restaurar routing/data |

## Pruebas de datos obligatorias antes de cualquier cutover

- Conteos por tabla, estado y fecha.
- Unicidad de email, placa, PNR, payment reference e idempotency key.
- FK actuales sin huérfanos antes de convertir a IDs lógicos.
- Mapeo 1:1 de vehicle UUID interno a `vehicle_id` público.
- Hash por fila normalizada para snapshots de orders/payments.
- Solapamientos de órdenes y holds detectados.
- `km_retorno >= km_salida`, mileage monotónico y fuel 0–100.
- Cooldowns activos con `ends_at` y estado coherente.
- Secretos de webhook siguen cifrados.
- Replays de idempotencia devuelven mismo status/body.
- PII del conductor no aparece en logs, QR ni eventos públicos.

## Lo que no debe eliminarse

No hay candidato de eliminación inmediata. Incluso columnas redundantes (`status` y `operational_status`, nombres normalizados y snapshots) deben coexistir hasta definir canonical source, completar backfill, medir paridad y aprobar una migración reversible.
