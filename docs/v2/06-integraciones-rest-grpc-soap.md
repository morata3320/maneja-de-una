# Integraciones REST, gRPC y SOAP

## REST

- `/api/v2/autos`: 19 operaciones del contrato oficial.
- `/autos/v1`: contrato legacy preservado.
- Autenticación con JWT externo, JWT interno o `X-API-Key` configurada.

## gRPC

PENDIENTE. El contrato oficial describe `inventory.InventoryStockService`, pero las reglas vigentes del repositorio impiden introducir gRPC todavía. No se simula sincronización con Booking. Variables y cliente deberán añadirse cuando se autorice el protocolo y exista destino verificable.

## SOAP

PENDIENTE. Los pagos actuales son mock REST y se identifican como simulados. No se afirma procesamiento o reembolso financiero real.
