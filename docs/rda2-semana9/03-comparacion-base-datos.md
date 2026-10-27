# Comparación de base de datos: Maneja de Una vs SQL maestro

Fuente actual: tres migraciones TypeORM (`179020...`, `179030...`, `179040...`). Fuente compartida: `base autos.txt`, SHA-256 registrado en `01-analisis-contratos.md`. Esta es una comparación estática; no se consultó ni modificó Azure.

## Contradicción de topología

El SQL se presenta como Database-per-Service pero crea cuatro schemas en una sola base. También declara IDs lógicos “sin FKs entre schemas”, aunque algunas responsabilidades propuestas requieren siete dominios. Antes de migrar debe decidirse si “database” significa instancia/base física o schema lógico. La propuesta de este documento asume ownership lógico primero y bases físicas después.

## Tablas equivalentes: comparación columna por columna

### `suppliers` → `catalog.suppliers`

| Actual | SQL compartido | Diferencia/acción |
|---|---|---|
| `id integer identity PK` | `id serial PK` | Compatible técnico; no usarlo como ID interservicio |
| — | `supplier_id integer NOT NULL UNIQUE` | Crear ID público estable; inicialmente copiar `id` |
| `name text NOT NULL` | `name varchar(100) NOT NULL` | Validar longitudes antes de estrechar |
| `active boolean NOT NULL default true` | — | Conservar; el maestro perdería soft-delete |
| `created_at`, `updated_at` timestamptz | — | Conservar auditoría |

Relaciones actuales: `vehicles.supplier_id → suppliers.id`; `depots.supplier_id → suppliers.id`. Maestro: IDs lógicos sin FK explícita. Restricciones faltantes en maestro: `active`, timestamps y longitud/normalización única de nombre.

### `depots` + `depot_scores` + `locations` → `catalog.depots`

| Actual | SQL compartido | Diferencia/acción |
|---|---|---|
| `depots.id integer identity PK` | `id uuid default gen_random_uuid() PK` | Requiere mapa legacy integer → UUID interno |
| — | `depot_id integer NOT NULL UNIQUE` | Usar el `depots.id` actual como ID lógico inicial |
| `supplier_id integer NOT NULL FK` | — | El maestro omite proveedor de agencia; no eliminar |
| `location_id uuid NOT NULL FK locations` | — | Maestro aplana ubicación; conservar tabla Location o snapshot lógico |
| `name text NOT NULL` | `name varchar(200) NOT NULL` | Compatible tras validar longitud |
| `city_id integer nullable` | `city_id integer NOT NULL` | Actual contiene city textual en Location; requiere catálogo de ciudades aprobado |
| `airport text nullable` | `airport varchar(10) nullable` | Validar IATA/longitud |
| `latitude`, `longitude numeric(10,7)` | — | Conservar; necesarios para búsqueda geográfica |
| `active boolean`, timestamps | — | Conservar |
| `depot_scores.score numeric(4,2) CHECK 0..10` | `score numeric(3,2) default 0` | `numeric(3,2)` no almacena 10.00; contradicción/bug del maestro. Definir escala y rango |

Constraints actuales: PK depot; FK supplier/location; `UNIQUE(id,supplier_id)`; score PK/FK y CHECK 0–10. Maestro: PK UUID, `UNIQUE(depot_id)`, sin FKs ni check de score.

### Catálogo normalizado + `vehicles` → `catalog.vehicles`

El actual separa `brands`, `vehicle_models` y `categories`; el maestro desnormaliza `make`, `model`, `car_type` en cada unidad.

| Actual `vehicles` | SQL compartido | Diferencia/acción |
|---|---|---|
| `id uuid PK` | `id uuid default PK` | Conservar |
| — | `vehicle_id varchar(50) NOT NULL UNIQUE` | Definir ID público inmutable; no usar placa |
| `brand_id uuid FK brands` | `make varchar(100)` | Proyectar nombre, no eliminar brand maestra |
| `model_id uuid` + FK compuesta `(model_id,brand_id)` | `model varchar(100)` | Proyectar nombre; conservar integridad actual |
| `category_id uuid FK categories` | `car_type varchar(50)` | Requiere tabla de mapeo ECONOMICO/COMPACTO/SUV/PREMIUM/VAN |
| `location_id uuid FK locations` | — | Maestro sólo usa depot; decidir ownership |
| `supplier_id integer FK suppliers` | `supplier_id integer lógico` | Mismo concepto, cambia FK por contrato |
| `depot_id integer`, FK compuesta con supplier | `depot_id integer lógico` | Conservar validación en Inventory sin FK cruzada |
| `year integer NOT NULL` | — | Conservar; maestro perdería año |
| `color text NOT NULL` | — | Conservar |
| `license_plate text NOT NULL UNIQUE` | — | Conservar obligatoriamente para unidad física |
| `transmission text NOT NULL` | `transmission varchar(50) NOT NULL` | Normalizar enums MANUAL/AUTOMATICO |
| `fuel_type text NOT NULL` | — | Conservar |
| `seats int CHECK >0` | `seats int NOT NULL` | Mantener CHECK actual |
| `doors int CHECK >0` | `doors int NOT NULL` | Mantener CHECK actual |
| `bag_capacity int default 2` | igual sin default/check | Conservar default y agregar CHECK >=0 |
| `price_per_day numeric(12,2) CHECK >0` | `numeric(10,2)` | Pricing debería ser dueño; no reducir precisión |
| `mileage int default 0` | `odometer_km int default 0` | Renombre; agregar CHECK >=0 |
| `next_maintenance_km int default 10000 CHECK >=0` | igual sin CHECK | Mantener CHECK |
| `description text` | — | Conservar en Catalog |
| `status` legacy `AVAILABLE/RESERVED/RENTED/MAINTENANCE/INACTIVE` | `status` 6 estados ingleses | No mapear directamente; actual ya tiene `operational_status` separado |
| `operational_status` 6 estados españoles | — | Mapear 1:1 a status maestro; evitar dos fuentes de verdad |
| `fuel_level int CHECK 0..100` | — | Debe pertenecer a Inventory/Counter; conservar |
| `active boolean` | — | Conservar soft-delete |
| timestamps | — | Conservar auditoría |
| — | `image_url varchar(300)` | Derivar de helper/asset; no almacenar ruta hasta decidir media ownership |
| — | `min_driver_age integer` | Añadir sólo tras definir default/check 18..100 |
| — | `available_from timestamptz` | Puede derivarse de cooldown, pero conviene snapshot en Inventory |

Constraints actuales adicionales: placa única, FKs a brand/category/location/supplier y compuestas a model/depot. Maestro: PK, `UNIQUE(vehicle_id)`, CHECK de seis estados e índices por status/depot; carece de checks numéricos y FKs incluso dentro de `catalog` pese a declarar supplier/depot del mismo owner.

### `maintenance_records` → `catalog.maintenance_log`

| Actual | SQL compartido | Diferencia/acción |
|---|---|---|
| `id uuid PK` | `id serial PK` | No degradar UUID; exponer `BIT-AUTO-*` como código, no PK |
| `vehicle_id uuid FK vehicles` | `vehicle_id varchar(50)` lógico | Migrar al ID público y eliminar FK sólo al separar DB |
| `technician_id text` | `varchar(100)` | Validar longitud; ID lógico de Identity |
| `mileage int CHECK >=0` | `odometer_km int` | Renombre; maestro carece CHECK |
| `fuel_level int CHECK 0..100` | `fuel_level int` | Mantener CHECK |
| `body_condition text` | `varchar(300)` | Validar longitud |
| `tire_condition text` | `tires_condition varchar(100)` | Renombre |
| `notes text` | `varchar(500)` | Validar longitud |
| `maintenance_performed boolean default false` | `maintenance_done` | Renombre |
| `next_maintenance_km int nullable CHECK >= mileage` | — | Conservar; maestro no puede auditar nuevo umbral |
| — | `alert boolean default false` | Puede persistirse como snapshot derivado |
| `created_at` | igual | Compatible |

Índice actual `(vehicle_id, created_at DESC)`; maestro no define índice. Ownership recomendado: `ms_maintenance`, no `catalog`.

### `orders` → `booking.orders`

| Actual | SQL compartido | Diferencia/acción |
|---|---|---|
| `id uuid PK` | igual | Conservar |
| `vehicle_id uuid FK vehicles` | sólo dentro de `vehicle_details jsonb` | Al separar, guardar `vehicle_id` lógico explícito + snapshot; no ocultarlo sólo en JSON |
| `owner_id text` | `customer_id varchar(50) nullable` | Mapear usuario/invitado; decidir tipo UUID/string |
| `preview_id uuid nullable unique FK` | — | Conservar proceso de preview o retirarlo mediante migración posterior, nunca perder trazabilidad |
| `locator text unique` | `varchar(30) unique` | Conservar; v3 exige PNR |
| `status CHECK CONFIRMED/CANCELLED/PENDING/COMPLETED` | comentario añade ENTREGADO/COMPLETADA pero sin CHECK | Separar estado de reserva y estado operativo; aprobar enum |
| `route jsonb` | `route_details jsonb` | Renombre/snapshot |
| `starts_at`, `ends_at`, CHECK start<end | sólo dentro de route JSON | Mantener columnas indexables; el maestro perdería protección de solapamiento |
| `price_per_day numeric(12,2)` | dentro de `pricing jsonb` | Conservar snapshot explícito o pricing versionado |
| `total_amount numeric(12,2)` | `total_price numeric(10,2)` | No reducir precisión; renombre |
| `currency text` | `varchar(3)` | Agregar CHECK/ISO |
| `extras jsonb default []` | igual | Compatible |
| `vehicle_details jsonb` | igual | Compatible |
| `driver_details jsonb NOT NULL` | nullable | No relajar sin decisión; proteger PII |
| `payment_reference text nullable` | `varchar(100)` lógico | Compatible |
| `coverage_type CHECK BASICA/TOTAL/PREMIUM` | `varchar(10)` default BASICA, comentario BASICA/TOTAL | V3 añade BASIC; decidir canonical storage |
| — | `deposit numeric(10,2)` | Actual cobertura tiene deposit; persistir snapshot en orden |
| — | `pricing jsonb` | Actual puede reconstruir parcialmente; agregar snapshot si se aprueba |
| `digital_checkin_at` | `checkin_at` | Renombre |
| `delivered_at`, `returned_at` | iguales | Compatible |
| `initial_mileage`, `final_mileage` con checks | `km_salida`, `km_retorno` sin checks | Mantener checks y mapear nombres |
| `delivery_agent` | — | Conservar auditoría |
| `refund_reference` | `refund jsonb` | Payments debe ser dueño; guardar snapshot/referencia, no verdad financiera duplicada |
| timestamps `created_at`,`updated_at` | sólo `creation_date` | Conservar ambos |

Índices actuales: disponibilidad parcial `(vehicle_id,starts_at,ends_at)`, owner/created. Maestro: customer/status. El índice de intervalos actual es esencial y no tiene reemplazo en el SQL maestro.

### Webhooks/outbox

#### `webhook_subscriptions` → `booking.webhook_subscriptions`

| Actual | Maestro | Acción |
|---|---|---|
| `id uuid PK` | UUID default PK | Compatible |
| `owner_id text NOT NULL` | — | Conservar aislamiento multi-tenant |
| `url text` | varchar(500) | Validar longitud/SSRF |
| `events jsonb` | igual | Compatible |
| `encrypted_secret text` | `secret varchar(100)` | No copiar maestro: conservar cifrado, nunca plaintext |
| `active`, timestamps | — | Conservar |

#### `webhook_delivery_attempts` → `booking.webhook_deliveries`

| Actual | Maestro | Acción |
|---|---|---|
| `id uuid PK` | igual | Compatible |
| `event_id uuid FK outbox` | varchar lógico | Quitar FK sólo tras separación |
| `subscription_id uuid FK` | varchar lógico | Igual |
| `attempt_count`, `status default PENDING`, `next_attempt_at` | `attempts`, `status DELIVERED/FAILED` | Actual soporta retry planificado; conservar |
| `last_error`, `last_status` | sólo last_error | Conservar HTTP status |
| `UNIQUE(event_id,subscription_id)` | — | Mantener deduplicación |
| timestamps | sólo created_at | Conservar |

#### `webhook_outbox` → `booking.outbox_events`

| Actual | Maestro | Acción |
|---|---|---|
| `id uuid PK` | `seq serial PK` + `event_id unique` | Mantener UUID público y añadir secuencia/cursor si se necesita |
| `owner_id` | — | Conservar scope |
| `event_type` | `type varchar(120)` | Normalizar a CloudEvents |
| `resource_id` | dentro de data | Conservar indexable |
| `data jsonb` | igual | Compatible |
| `dispatched boolean` | `published_at timestamptz` | `published_at` ofrece mejor auditoría; migración aditiva |
| timestamps | `time`, `published_at` | Mapear sin perder created/updated |

### `promotion_agreements` → `booking.promo_contract`

| Actual | Maestro | Acción |
|---|---|---|
| `id boolean PK CHECK(id)` | `id integer PK` | Ambos fuerzan fila única de forma distinta; aprobar estrategia |
| `allows_promotions default false` | default true | Contradicción de negocio; no cambiar silenciosamente |
| `max_discount_percent default 0 CHECK 0..100` | `max_discount_percentage default 15`, sin CHECK | Mantener CHECK; decidir default |
| `enabled_destinations jsonb default []` | igual | Compatible |
| `valid_until date` | `varchar(10)` | Conservar tipo date |
| `terms text` | `combo_conditions varchar(500)` | Mapear y validar longitud |
| `updated_by`, timestamps | — | Conservar auditoría |

### `payments` → `payments.payments`

| Actual | Maestro | Acción |
|---|---|---|
| `id uuid PK` | UUID default PK | Compatible |
| `order_id uuid UNIQUE FK orders` | `order_id varchar(50)` lógico nullable | Quitar FK sólo al separar; conservar unicidad de consumo |
| `user_id uuid FK users` | — | Conservar actor lógico o mover customer_id |
| `amount numeric(12,2) CHECK >0` | numeric(10,2) | No reducir precisión; mantener CHECK |
| `currency text default USD` | varchar(3) | Añadir ISO CHECK |
| `status CHECK APPROVED/DECLINED` | comentario añade REFUNDED, sin CHECK | Añadir REFUNDED mediante migración aprobada |
| `method default CARD` | — | Conservar |
| `card_brand`, `card_last4 CHECK regex` | mismos conceptos sin CHECK | Mantener regex |
| — | `cardholder_name NOT NULL` | Evaluar necesidad/PII antes de agregar |
| — | `decline_reason` | Útil, aditivo |
| `payment_reference unique` | `reference unique` | Renombre |
| — | `order_preview_id NOT NULL` | Actual payment nace para order; decidir workflow canónico |
| timestamps created/updated | sólo created | Conservar |

### `users` → `identity.admins` + `identity.customers`

| Actual `users` | Maestro | Acción |
|---|---|---|
| `id uuid PK` | UUID PK en ambas | Conservar |
| `name`, `first_name`, `last_name` | first/last separados | Migrar sin perder `name` hasta reconciliar |
| `email unique` | sólo customers.email | Admin maestro usa username; decidir login admin |
| `password_hash` | ambos | Compatible |
| `role CHECK USER/ADMIN` | separación por tabla; guía añade MANTENIMIENTO/OPERADOR | No separar físicamente hasta acordar RBAC unificado |
| `cedula unique nullable` | — | Conservar, clasificar PII |
| `phone` | `phone_number` customers | Renombre |
| `active`, `status CHECK ACTIVE/INACTIVE/SUSPENDED` | — | Conservar |
| timestamps created/updated | sólo created | Conservar |

Contradicción: SQL dice que admin bootstrap no está en DB, pero también crea `identity.admins`; RodadoEc implementa ambos. Debe decidirse una única política.

## Tablas actuales sin equivalente directo en el SQL maestro

| Tabla actual | Columnas, constraints y relaciones | Destino propuesto |
|---|---|---|
| `brands` | id PK, name, active, timestamps | `ms_catalog`; conservar normalización |
| `vehicle_models` | id PK, brand_id FK, name, active, `UNIQUE(id,brand_id)`, timestamps | `ms_catalog`; conservar |
| `categories` | id PK, name, description, active, timestamps | `ms_catalog`; mapear a enum externo |
| `locations` | id PK, name, city, province, active, timestamps | Catalog/Inventory; no sustituir por `city_id` mágico |
| `depot_scores` | depot_id PK/FK, score CHECK 0..10, timestamps | Catalog; puede integrarse a depot con migración sin pérdida |
| `search_contexts` | id PK, affiliate, context JSON, results UUID[], expiry, timestamps | Gateway/cache o Search; no tabla core de Order |
| `holds` | id PK, vehicle FK, owner, search FK, intervalo CHECK, precio, currency, expiry, consumed, timestamps; índice parcial | `ms_inventory`; esencial para concurrencia |
| `order_previews` | id PK, vehicle FK, owner, hold FK, route, precios, extras, expiry, consumed, timestamps | `ms_order`/Pricing; preservar si checkout mantiene preview |
| `idempotency_records` | PK compuesta owner/operation/key, fingerprint, status/response, timestamps | Gateway u Order según operación; imprescindible |
| `favorites` | id PK, user FK, vehicle FK, UNIQUE user/vehicle, timestamps | Dominio aparte o Catalog facade; no aparece en arquitectura objetivo |
| `vehicle_cooldowns` | id PK, vehicle/order FKs, intervalo CHECK, UNIQUE order, completed, created; índice activo | `ms_inventory`; maestro sólo tiene `available_from`, menos auditable |
| `rental_inspections` | id PK, order/vehicle FKs, type CHECK, mileage CHECK, fuel CHECK, condiciones, agent, UNIQUE order/type | `ms_counter`; ausente en maestro |
| `coverage_plans` | code PK, precios/deductible/deposit CHECK >=0, description, active, timestamps | `ms_pricing`; maestro sólo snapshot en order |
| `reservation_status_history` | id PK, order FK, from/to, actor, correlation, metadata, created; índice order/time | `ms_order`; trazabilidad ausente en maestro |

## Conclusión de datos

El SQL maestro no es todavía apto para reemplazar el esquema actual: pierde catálogo normalizado, placa/año/color/combustible, intervalos indexables, holds, previews, idempotencia, favoritos, inspecciones, planes de cobertura, historial y controles de seguridad. Debe tratarse como mínimo común compartido, no como script de sustitución. La migración deberá ser dual-write/backfill verificable y reversible, nunca `DROP/CREATE` sobre Azure.
