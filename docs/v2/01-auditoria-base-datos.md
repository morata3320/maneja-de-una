# Auditoría de base de datos V2

## Estado inicial

El esquema tiene claves primarias y foráneas explícitas, unicidad de matrícula, índices de disponibilidad y tablas de idempotencia/outbox. `Vehicle` representa una unidad física; la disponibilidad temporal se calcula contra `orders` y `holds`.

## Cambio aplicado

La migración `1790400000000-autos-rda2-operations.ts` es aditiva y reversible fuera de producción. Agrega:

- Estado operativo, umbral de mantenimiento y combustible a `vehicles`.
- Datos de cobertura, check-in, entrega, devolución y reembolso mock a `orders`.
- `vehicle_cooldowns`, `rental_inspections`, `maintenance_records`, `coverage_plans`, `promotion_agreements` y `reservation_status_history`.
- Checks de estados, kilometraje, combustible, porcentajes y rangos temporales.
- Índices para cooldown, mantenimiento e historial.

No elimina ni transforma vehículos, usuarios, reservas o pagos existentes. Se verificó `up → down → up` contra PostgreSQL 16 local.

## Riesgos controlados

- Las reservas usan bloqueo de fila y detección de solapamiento dentro de una transacción.
- Los eventos se insertan en `webhook_outbox` en la misma transacción del cambio de dominio.
- El cooldown vencido sólo retorna a `DISPONIBLE` cuando el kilometraje no exige mantenimiento; de lo contrario pasa a `EN_MANTENIMIENTO`.
