# Prueba local mínima — Booking y MANEJA DE UNA

**Esto es un puente temporal en un proceso Node.js**, no una implementación completa de los microservicios de la rúbrica. Expone el contrato v3 y utiliza los esquemas compartidos `catalog`, `booking`, `payments` e `identity` en el mismo PostgreSQL que V2, dejando intacto `public`. No es sincronización automática del catálogo antiguo: los 31 vehículos del SQL son datos de referencia de RodadoEc, NO equivalen a los vehículos de MANEJA DE UNA. Sustituir/separar los datos de muestra cuando se acuerde catálogo único.

## Preparación en Windows PowerShell

1. Descomprime este ZIP en `C:\Users\NW\Desktop\sexto\practicas\integracion\maneja-de-una\integrations\booking-v3-bridge` (crea la carpeta si falta). No sobrescribas `apps/api`.
2. Asegúrate de que tu PostgreSQL Docker existente está activo en `127.0.0.1:15432` y que el contenedor se llama `maneja-de-una-postgres-1`.
3. Desde la carpeta descomprimida, instala **solo** el SQL oficial y la extensión. Si el contenedor se llama distinto, cambia su nombre en los comandos:

```powershell
# Estos comandos agregan schemas nuevos: NO hacen DROP ni modifican public.
docker cp .\sql\01_sql_maestro_original.sql maneja-de-una-postgres-1:/tmp/autos_master.sql
docker cp .\sql\02_extension_no_destructiva.sql maneja-de-una-postgres-1:/tmp/autos_extension.sql
docker exec maneja-de-una-postgres-1 psql -v ON_ERROR_STOP=1 -U maneja_de_una -d maneja_de_una -f /tmp/autos_master.sql
docker exec maneja-de-una-postgres-1 psql -v ON_ERROR_STOP=1 -U maneja_de_una -d maneja_de_una -f /tmp/autos_extension.sql
```

4. `Copy-Item .env.example .env`, abre `.env`, pon tu contraseña **local** real y crea **dos claves nuevas diferentes, mínimo 32 caracteres**, una en `BOOKING_API_KEY`, otra en `ADMIN_API_KEY`. Nunca pegues claves al chat. Deja `BOOKING_GRPC_ADDR=` vacío hasta que Booking comparta su IP/puerto.
5. Necesitas Node.js 20 o superior; ejecuta `npm install` y luego `npm test`.
6. Ejecuta `npm start`. El puente escucha en `0.0.0.0:3100`, que evita conflicto con NestJS V2 en el puerto 3000. **No modifica V2**.

## Verificaciones REST

Desde otra terminal PowerShell:

```powershell
curl.exe -i http://127.0.0.1:3100/api/v3/autos/health
curl.exe -i http://127.0.0.1:3100/api/v3/autos
```

Para una reserva de prueba:

```powershell
$headers = @{ 'Content-Type'='application/json'; 'X-API-Key'='<TU_CLAVE_BOOKING>'; 'Idempotency-Key'=[guid]::NewGuid().ToString(); 'X-Correlation-Id'='test-autos-01' }
$body = @{vehicle_id='veh-001';pickup_date='2026-11-15';dropoff_date='2026-11-18';pickup_time='10:00';dropoff_time='10:00';coverage_type='BASIC';driver=@{full_name='Cliente Prueba';email='test@example.com';phone='+593999999999';license_number='TEST-123';age=25}} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3100/api/v3/autos/reservas' -Headers $headers -Body $body
```

Esperado: `201`, objeto con `order_id`, `pnr`, `status=RESERVADO`, `voucher_qr_payload`, `total_price`. Repetir con **una clave distinta** y mismo `veh-001`: `409 VEHICLE_UNAVAILABLE`. Repetir con la **misma clave y mismo cuerpo**: retorna el resultado 201 original sin reservar dos veces. Edad 17: `422 DRIVER_UNDERAGE`.

## Sincronización gRPC al receptor de Booking

En la reunión usa la IP **real** del compañero de Booking sobre Tailscale. Ejemplo de variables (NO es una dirección real):

```dotenv
BOOKING_GRPC_ADDR=100.X.Y.Z:50051
BOOKING_GRPC_TLS=false
STOCK_SYNC_ENABLED=true
```

Reinicia el puente. Booking debe compartir o aceptar el nodo Tailscale. Para enviar un inventario inicial **del día y turno real de pruebas**:

```powershell
$headers = @{'Content-Type'='application/json';'X-Admin-Key'='<TU_CLAVE_ADMIN>'}
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3100/api/v3/internal/sync-stock -Headers $headers -Body '{"date":"2026-11-15","time_slot":"10:00"}'
```

Esto **encola** actualizaciones, no certifica que Booking las recibió. Comprueba el ACK real y consulta:

```powershell
docker exec maneja-de-una-postgres-1 psql -U maneja_de_una -d maneja_de_una -c 'SELECT item_id,available_units,attempts,acknowledged_at,last_error FROM booking.stock_sync_outbox ORDER BY seq DESC LIMIT 10;'
```

El receptor gRPC usa transporte sin TLS **solo dentro de Tailscale para la prueba local**. Para nube confirma host, HTTP/2 y TLS con Booking antes de cambiarlo.

## Tailscale

Comparte la IP que devuelve `tailscale ip -4`; Booking debe utilizar como base URL `http://TU_IP_TAILSCALE:3100/api/v3` y enviar `X-API-Key`. La guía local permite HTTP dentro de la red privada. Abre el firewall únicamente para los equipos autorizados de Tailscale y puerto 3100.

## Lo que NO queda resuelto por este kit

- No sustituye el backend NestJS V2 ni los microservicios independientes acordados por todo el equipo.
- No migra automáticamente datos desde `public.vehicles` a `catalog.vehicles` porque el mapeo real de columnas y claves del proyecto no se ha proporcionado.
- No implementa cobro real: cancelaciones registran estado de reembolso **SIMULATED**.
- No implementa Kafka/RabbitMQ como procesos ni API Gateway Kong; añade un emisor gRPC y eventos en una tabla Outbox.
- No está probado contra el Booking externo; solo se puede afirmar éxito una vez recibido 201/409/422 y ACK gRPC desde la otra computadora.
- El esquema compartido no ofrece múltiples reservas por fechas para un auto ocupado: esta versión aplica bloqueo operativo por estado. Se necesita inventario por intervalos para producción.
- El frontend anterior sigue usando V2; la prueba de hoy se hace contra V3 por el puerto 3100.
