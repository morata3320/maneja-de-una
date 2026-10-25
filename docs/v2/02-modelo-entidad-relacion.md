# Modelo entidad-relación V2

```mermaid
erDiagram
  USERS ||--o{ ORDERS : owns
  VEHICLES ||--o{ ORDERS : reserved_as
  VEHICLES ||--o{ VEHICLE_COOLDOWNS : enters
  ORDERS ||--o| VEHICLE_COOLDOWNS : triggers
  ORDERS ||--o{ RENTAL_INSPECTIONS : records
  VEHICLES ||--o{ RENTAL_INSPECTIONS : inspected
  VEHICLES ||--o{ MAINTENANCE_RECORDS : serviced
  ORDERS ||--o{ RESERVATION_STATUS_HISTORY : transitions
  ORDERS ||--o| PAYMENTS : paid_by
  VEHICLES ||--o{ HOLDS : temporarily_blocks
  WEBHOOK_OUTBOX ||--o{ WEBHOOK_DELIVERY_ATTEMPTS : delivers
```

`vehicles` conserva su semántica de unidad física. El estado operativo no sustituye el cálculo de disponibilidad en un intervalo: una unidad `DISPONIBLE` puede estar reservada en el futuro y continuar utilizable fuera de ese intervalo.
