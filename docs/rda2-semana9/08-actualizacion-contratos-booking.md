# Actualización de contratos Booking — 2026-10-27

## Fuentes y trazabilidad

Los documentos recibidos se conservaron como referencias nuevas, sin reemplazar los contratos versionados:

- `references/autos-openapi-v3-booking-20261027.yaml`
- `references/GUIA_INTEGRACION_AUTOS-booking-20261027.md`

SHA-256 de los archivos originales recibidos:

- OpenAPI anterior: `D21F2B958F0318A68791BD7FF71C5FE0E89B852DDC3EFC5B1F7D8931BAC1D0AE`
- OpenAPI nuevo: `E77DD7DEAEEB4739B1EE0167A676EB4FC0FE6D7C575C17FDD80FCE14A3FB84E0`
- Guía anterior: `C7A517CC5C7027A29DFC678513F2C58C93EE0B76BA7406DDECF3094D7A4DE300`
- Guía nueva: `5B4F17DD795A1C1374027F19647D6FB3F252F116FE05D88A64D1F299C984F04F`
- Protobuf implementado: `E5A3661BD8897AB13A6368AC962B3ED8F253049951993D4D857CA95210434F31`

Las referencias del repositorio están normalizadas a LF. Los hashes anteriores corresponden a los bytes originales de `Downloads`, usados para la comparación byte a byte.

## Diferencias OpenAPI

Los OpenAPI no son idénticos. Conservan las mismas 19 operaciones, métodos, respuestas HTTP, esquemas de seguridad y lista de servidores. El cambio semántico es limitado a:

- ejemplos de licencia/cédula: `1723456789` pasa a `1710034065`;
- `vehicle_id` se documenta como alias tolerado de `auto_id` en la respuesta de orden;
- `voucher_qr_payload` se documenta como alias tolerado de `voucher_qr_data`;
- se aclara que `auto_id` y `voucher_qr_data` son los campos canónicos.

La implementación ya devuelve ambos nombres de cada pareja de alias, por lo que no fue necesario alterar el DTO oficial ni el contrato recibido.

## Diferencias de la guía

La guía nueva agrega o precisa:

- gRPC local h2c, Tailscale para evaluación y un posible fallback REST;
- `service_id` con prefijo `NODE_AUT_`;
- `time_slot` en `HH:mm` y `slot_id` canónico `slot-YYYYMMDD-HHMM`;
- timestamp estrictamente creciente y rechazo de eventos obsoletos;
- stock `0` también durante mantenimiento;
- un solo evento en el retiro para alquileres de varios días;
- `X-API-Key` opcional/configurable;
- respuesta canónica `CONFIRMED`, `auto_id`, `voucher_qr_data`, manteniendo aliases;
- botones del dashboard que llaman `${baseUrlRest}/health` y `${baseUrlRest}/autos`.

Existe una contradicción interna: la sección de registro todavía menciona `/autos/health`, mientras la sección nueva de botones usa `/health`. La compatibilidad se resolvió con un alias de health que delega en el servicio V3 real y queda excluido de Swagger.

## URL de registro

Registrar exactamente:

`https://maneja-de-una-v3-api.onrender.com/api/v3`

Con esa base:

- dashboard health: `/api/v3/health` (alias de compatibilidad);
- dashboard catálogo: `/api/v3/autos` (operación oficial);
- reserva Booking: `/api/v3/autos/reservas` o `/api/v3/autos/orders/create`.

## Evidencia REST pública

Contra `https://maneja-de-una-v3-api.onrender.com`:

- registro sintético: 201; login: 200;
- catálogo V3: 200;
- reserva canónica: 201, con PNR e identificador;
- lectura posterior de la orden: 200 y mismo identificador (evidencia de persistencia remota);
- repetición de `Idempotency-Key`: 201 y mismo identificador;
- reserva incompatible: 409;
- conductor de 17 años: 422;
- cancelación: 200;
- nueva reserva del mismo vehículo y período: 201 con identificador nuevo;
- cancelación de limpieza: 200.

Las cuentas y reservas usadas fueron sintéticas; todas las reservas generadas quedaron canceladas.

## gRPC, fallback y dashboard

- El cliente implementa `inventory.InventoryStockService/PushStockUpdate`, Outbox, reintentos, deduplicación, `slot-YYYYMMDD-HHMM`, stock 0/1 y timestamp monotónico.
- `rda1-backend-integracion-sistemas.onrender.com:50051` no aceptó conexión TCP en la prueba.
- El fallback respondió `OPTIONS 204`, pero `GET 404`. No se envió `POST` porque no hay cuerpo oficial publicado.
- `STOCK_SYNC_ENABLED=false` se mantiene. No existe ACK real y no se reprodujeron eventos históricos.
- El registro central lista cinco nodos, ninguno de Maneja de Una. `POST /api/v1/nodes` devolvió 401 sin token y no creó el nodo.
- La validación final del nodo, importación desde el dashboard y ACK central quedan pendientes de una sesión autorizada de Booking.
