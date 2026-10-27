# Comparación de arquitectura y microservicios

## Maneja de Una actual

Monolito modular NestJS 12, TypeScript 6, TypeORM 1.1 y PostgreSQL 16/Azure. Un proceso contiene identidad, administración, catálogo, favoritos, reservas, pagos mock, Autos legacy `/autos/v1`, marketplace `/api/v2` y adaptador Autos RDA2 `/api/v2/autos`. React/Vite consume `/api/v2`.

Fortalezas a conservar:

- Migraciones explícitas y `synchronize: false`.
- Separación de JWT interno y de integración.
- Entidades físicas de vehículo, reservas por intervalo, holds e idempotencia.
- Advisory locks/transacciones para evitar doble reserva.
- Outbox persistente, webhooks cifrados y correlation ID.
- Catálogo real de 29 unidades/16 modelos e imágenes de MANEJA DE UNA.
- Compatibilidad `/api/v1`, `/api/v2` y `/autos/v1`.

Acoplamientos a separar eventualmente:

- `V2Service` y `AutosV2Service` consultan múltiples tablas con SQL directo.
- Una sola transacción cruza catálogo, órdenes, operaciones y outbox.
- `vehicles` mezcla catálogo descriptivo, inventario físico y estado operativo.
- `orders` mezcla reserva, checkout, counter y referencia de reembolso.
- `users` mezcla cliente y administrador.

## RodadoEc real en `microsevicios.txt`

No son siete microservicios. El archivo contiene cuatro procesos de dominio más Gateway:

| Proceso | Esquema | Responsabilidades observadas |
|---|---|---|
| `identity` | `identity` | customers, admins, JWT, login y administración de usuarios |
| `catalog` | `catalog` | catálogo, inventario/estado, depósitos, proveedores y mantenimiento |
| `booking` | `booking` | búsqueda/reserva, counter, promociones, outbox, webhooks y cliente de stock |
| `payments` | `payments` | cargo, consumo y refund mock |
| `gateway` | sin tablas propias | REST v1/v2/v3, GraphQL, auth, idempotencia y clientes gRPC internos |

Protocolos internos observados: gRPC entre Gateway y los cuatro servicios; Booking también llama Catalog y Payments. RabbitMQ/Kafka son opcionales. GraphQL vive en Gateway.

Riesgos que no deben copiarse sin decisión:

- Credenciales de desarrollo por defecto (`rodadoec`, secretos JWT de ejemplo).
- `AUTH_ENFORCE_*` en `false` por defecto y despliegue Render con enforcement desactivado.
- Un solo PostgreSQL para cuatro schemas contradice Database-per-Service físico.
- `strictNullChecks`, `noImplicitAny` y otras opciones estrictas están desactivadas.
- Catálogo es dueño a la vez de disponibilidad y mantenimiento.
- Booking es dueño de order, counter, promotions, outbox y sincronización inventory.
- Los comentarios mencionan contrato v2 aun dentro de implementación v3.
- Kafka/RabbitMQ opcionales introducen dos mecanismos sin decisión de ownership.

## Siete dominios de la guía vs cuatro servicios RodadoEc

| Dominio provisional | RodadoEc | Maneja de Una actual | Propuesta |
|---|---|---|---|
| `ms_identity` | `identity` | Auth/Users/Admin modules | Extraíble; conservar IDs UUID y JWT separado |
| `ms_catalog` | parte de `catalog` | brands, models, categories, locations | Catálogo descriptivo; no debe poseer reservas |
| `ms_inventory` | parte de `catalog`; cliente stock en `booking` | vehicles + cálculo disponibilidad | Dueño de unidad física, estado, holds/cooldown y publicación gRPC |
| `ms_order` | `booking` | orders, previews, idempotency | Dueño de reserva/PNR/snapshot; consulta inventario por API |
| `ms_counter` | parte de `booking` | check-in y inspections en AutosV2Service | Dueño de entrega/devolución/inspecciones, o módulo del order hasta aprobar |
| `ms_maintenance` | parte de `catalog` | maintenance_records y umbral vehicle | Servicio separado con ID lógico de vehicle |
| `ms_pricing` | parte de `booking` y utilidades common | price_per_day, coverage_plans, pricing services | Dueño de tarifas/coberturas/promociones |
| Pagos | `payments` | payments mock | Servicio separado; mantener etiqueta MOCK |
| API Gateway | `gateway` | configureApp + controllers | Fachada v1/v2/v3, auth, rate limit y error mapping |

No debe asumirse equivalencia entre `catalog` RodadoEc y `ms_catalog`: RodadoEc agrupa tres dominios. Tampoco entre `booking` y `ms_order`: agrupa al menos order, counter, pricing/promotions e inventory integration.

## Distribución propuesta de responsabilidades

| Servicio | Es dueño de | No debe hacer |
|---|---|---|
| Gateway | routing, JWT/API key, rate limit, versionado, ProblemDetails, correlation | consultar tablas de dominio |
| Identity | credenciales, roles y perfiles mínimos | almacenar reservas/pagos |
| Catalog | marca/modelo/categoría/media/especificaciones | calcular disponibilidad |
| Inventory | unidad física, placa, depot lógico, estado, hold/cooldown, stock gRPC | almacenar snapshots de conductor |
| Order | PNR, período, conductor snapshot, cobertura elegida, estado de reserva, idempotencia | actualizar directamente vehicle |
| Counter | check-in, entrega, devolución e inspecciones | decidir tarifas |
| Maintenance | historial técnico, odómetro, umbral/alerta | leer tablas Inventory directamente |
| Pricing | tarifa, cobertura, recargo y convenio B2B | cobrar tarjeta |
| Payments | transacción, estado, referencia y refund | almacenar PAN/CVV |

## Integración recomendada

1. Gateway adapta OpenAPI v3 a comandos internos.
2. Order solicita un lease/hold a Inventory con idempotencia.
3. Pricing cotiza y devuelve snapshot inmutable.
4. Payments confirma transacción mock/real por contrato separado.
5. Order persiste PNR y outbox; la compensación libera el lease.
6. Inventory publica `PushStockUpdate` 0/1 después del commit mediante outbox.
7. Counter y Maintenance consumen comandos con IDs lógicos; nunca FKs cruzadas.

La primera etapa debe seguir siendo un “modular monolith with seams”: interfaces y ownership lógico dentro del repositorio actual, sin mover datos hasta aprobar SQL y responsabilidades.
