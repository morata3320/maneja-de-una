# PowerShell 5.1 - PRUEBA QUE CREA Y CANCELA UNA RESERVA EN LA BASE LOCAL.
# Ejecutar desde la raíz del kit DESPUÉS de instalar SQL y levantar el servidor.
$ErrorActionPreference='Stop'
$Base='http://127.0.0.1:3100/api/v3'
$line=(Get-Content .env | Where-Object { $_ -match '^BOOKING_API_KEY=' } | Select-Object -First 1)
if(-not $line){ throw 'Configura BOOKING_API_KEY en .env.' }
$key=($line -split '=',2)[1]
if($key.Length -lt 32){throw 'BOOKING_API_KEY debe tener 32+ caracteres.'}
function CallApi($Method,$Uri,$Body,$Idempotency){
 $headers=@{'X-API-Key'=$key;'X-Correlation-Id'='smoke-local-01'}
 if($Idempotency){$headers['Idempotency-Key']=$Idempotency}
 try {
  if($Body){ $r=Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $headers -ContentType 'application/json' -Body ($Body|ConvertTo-Json -Depth 20) }
  else { $r=Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $headers }
  return @{ status=[int]$r.StatusCode; data=($r.Content|ConvertFrom-Json) }
 } catch [System.Net.WebException] {
  $response=$_.Exception.Response
  if(-not $response){throw}
  $code=[int]$response.StatusCode
  $reader=New-Object IO.StreamReader($response.GetResponseStream());$content=$reader.ReadToEnd();$reader.Close()
  return @{status=$code;data=($content|ConvertFrom-Json)}
 }
}
$health=CallApi 'GET' "$Base/autos/health" $null $null
if($health.status -ne 200){throw "Health falló: $($health.status)"}
Write-Host 'PASS 200 health'
$body=@{ vehicle_id='veh-031';pickup_date='2026-11-15';dropoff_date='2026-11-18';pickup_time='10:00';dropoff_time='10:00';coverage_type='BASIC';driver=@{full_name='Cliente Prueba';email='test@example.com';phone='+593999999999';license_number='TEST-123';age=25}}
$key1=[guid]::NewGuid().ToString()
$a=CallApi 'POST' "$Base/autos/reservas" $body $key1
if($a.status -ne 201){throw "201 esperado: obtuvo $($a.status) - $($a.data.code)"}
Write-Host "PASS 201 creado $($a.data.pnr)"
$again=CallApi 'POST' "$Base/autos/reservas" $body $key1
if($again.status -ne 201 -or $again.data.order_id -ne $a.data.order_id){throw 'Idempotencia falló'}
Write-Host 'PASS reintento idempotente'
$conflict=CallApi 'POST' "$Base/autos/reservas" $body ([guid]::NewGuid().ToString())
if($conflict.status -ne 409 -or $conflict.data.code -ne 'VEHICLE_UNAVAILABLE'){throw "409 esperado: $($conflict.status)/$($conflict.data.code)"}
Write-Host 'PASS 409 VEHICLE_UNAVAILABLE'
$minor=$body.Clone();$minor.driver=@{full_name='Prueba Menor';email='minor@example.com';phone='+593999999999';license_number='TEST-123';age=17}
$invalid=CallApi 'POST' "$Base/autos/reservas" $minor ([guid]::NewGuid().ToString())
if($invalid.status -ne 422 -or $invalid.data.code -ne 'DRIVER_UNDERAGE'){throw "422 esperado: $($invalid.status)/$($invalid.data.code)"}
Write-Host 'PASS 422 DRIVER_UNDERAGE'
$cancel=CallApi 'POST' "$Base/autos/orders/$($a.data.order_id)/cancel" @{reason='Fin prueba local'} ([guid]::NewGuid().ToString())
if($cancel.status -ne 200){throw "Cancelación falló: $($cancel.status)"}
Write-Host 'PASS cancelación (reembolso MOCK, sin cobro real)'
