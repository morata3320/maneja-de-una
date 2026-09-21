# Backend: monolito modular

NestJS + TypeScript, REST + JSON bajo /api/v1. Swagger en /swagger y contrato generado en /swagger-json.
Health conserva su contrato y comprueba solo disponibilidad del proceso.

## Límites de módulos
Los contextos auth, users, vehicles, brands, models, categories, locations, rentals y favorites
están registrados como módulos Nest; los contextos de negocio contienen modelos puros y vehicles/rentals exportan servicios internos. auth sigue vacío. integrations/booking reserva la futura integración.
No hay controllers de dominio ni contratos inventados: el próximo paso es aprobar el contrato API-first.

Cada contexto será dueño de sus reglas y datos. Evitar acceder a internals de otros módulos;
exponer servicios públicos explícitos cuando el contrato los requiera. El dominio no debe
depender del ORM: las implementaciones de persistencia quedarán en infraestructura y se
conectarán mediante puertos específicos cuando exista una necesidad real. BD y ORM pendientes.
No se crean repositorios genéricos, buses de eventos ni abstracciones de transporte anticipadas.

Booking externo consume la API pública versionada, nunca la BD. No hay cliente HTTP,
adaptadores ni endpoints Booking. Una eventual separación a servicios, eventos o gRPC
requerirá otra decisión; ninguna de esas tecnologías está implementada.

## Infraestructura común
- config/: validación al iniciar. NODE_ENV acepta development, test o production;
  PORT es entero 1–65535; CORS_ORIGINS contiene orígenes HTTP(S) exactos separados por comas,
  sin rutas, credenciales, entradas vacías ni wildcard.
- common/middleware/: ID y log de cada respuesta finalizada, incluso preflight y errores de parseo.
- common/types/: contexto por request, disponible en req.correlationId y mediante
  requestContext.getStore() con AsyncLocalStorage, aislado entre operaciones concurrentes.
- common/filters/: formato único de errores.
- common/guards/: restricción de Content-Type en escrituras con cuerpo.
- decorators/, interceptors/ y exceptions/: espacios reservados sin implementaciones artificiales.

## Correlación y logs
X-Correlation-Id es opcional. Se reutiliza si tiene entre 1 y 128 caracteres ASCII
alfanuméricos, punto, guion o guion bajo, empezando por alfanumérico.
Ausente o inválido se sustituye por UUID. No es una credencial ni prueba de identidad.
Siempre se devuelve en el header y CORS permite leerlo desde el frontend.
En errores se llama requestId y contiene el mismo valor.

ConsoleLogger de Nest emite JSON: método, path sin query, statusCode, durationMs y correlationId.
No se registran cuerpos, cabeceras, mensajes de excepciones, stacks, tokens ni configuración.
No colocar secretos en paths ni IDs de correlación. No hay plataforma de telemetría.

## Errores y seguridad
Formato: { statusCode, error, message, path, timestamp, requestId }.
message puede ser string o string[] (validación). Los errores 5xx tienen mensaje seguro;
no se devuelven stacks ni detalles internos en ningún entorno.
Se conservan Helmet y ValidationPipe (whitelist, forbidNonWhitelisted, transform).

CORS autoriza orígenes explícitos con credentials; admite GET, POST, PUT, PATCH, DELETE, OPTIONS
y headers Content-Type, Authorization, X-Correlation-Id. Un origen no permitido no recibe ACAO.
CORS es una política del navegador, no un mecanismo de autenticación.

POST/PUT/PATCH/DELETE con cuerpo requieren application/json o application/*+json.
Otros tipos reciben 415 en rutas controladas por Nest. GET/HEAD/OPTIONS no se bloquean por esta regla.
JSON malformado devuelve 400. El parser limita el cuerpo a 100 KB.
Futuros uploads necesitarán un contrato y una excepción explícita a esta política.

ThrottlerGuard es global en controladores Nest: por defecto 100 requests por IP y endpoint
en 60000 ms. RATE_LIMIT_MAX y RATE_LIMIT_TTL_MS permiten ajustarlo al arrancar.
Health está exento; preflight y Swagger no pasan por los guards de controladores.
Al excederlo devuelve 429 uniforme y Retry-After. Estado en memoria por proceso.
Antes de desplegar detrás de proxy se debe definir trust proxy según la topología real;
no se confía indiscriminadamente en X-Forwarded-For. Varias réplicas requerirán otra decisión
sobre almacenamiento compartido, aún no implementado.

## Convenciones HTTP
| Código | Uso |
| --- | --- |
| 200 OK | Lectura o actualización con respuesta |
| 201 Created | Recurso creado |
| 204 No Content | Éxito sin cuerpo |
| 400 Bad Request | Entrada o JSON inválidos |
| 401 Unauthorized | Credenciales ausentes o inválidas, cuando exista autenticación |
| 403 Forbidden | Acción no permitida |
| 404 Not Found | Ruta o recurso inexistente |
| 409 Conflict | Conflicto con estado del recurso |
| 415 Unsupported Media Type | Tipo del payload no admitido |
| 429 Too Many Requests | Límite de solicitudes excedido |
| 500 Internal Server Error | Fallo inesperado |
| 503 Service Unavailable | Servicio temporalmente no disponible |

Los controllers de prueba de infraestructura viven solo en test/; nunca se cargan en producción.


## Modelo de dominio preliminar

El modelo es preliminar y NO constituye todavía el contrato REST final.
Cada contexto guarda sus tipos y reglas en domain/, sin dependencias de NestJS, HTTP u ORM.
Son interfaces readonly (no validadores de objetos externos); las referencias son IDs sin
formato de UUID impuesto. createdAt/updatedAt representan instantes ISO UTC y serán
asignados por los futuros casos de uso, no por estos tipos.

| Modelo | Responsabilidad |
| --- | --- |
| Vehicle | Unidad física, referencias a marca/modelo/categoría/ubicación, características, tarifa y estado |
| Rental | Alquiler/reserva, vehículo/usuario, período, tarifa pactada, total y estado |
| Brand | Marca activa/inactiva que agrupa modelos |
| VehicleModel | Modelo con brandId obligatorio; la aplicación futura verificará existencia y coherencia con Vehicle.brandId |
| Category | Clasificación editable como datos, sin catálogo fijo |
| Location | Lugar operativo, ciudad y provincia; sin ubicaciones precargadas |
| Favorite | Relación usuario–vehículo; prechequeo puro y futura unicidad persistente del par |
| User | Nombre, email, rol CUSTOMER/ADMIN y estado activo; sin credenciales |

Estados Vehicle: AVAILABLE permite evaluar reserva; RESERVED, RENTED, MAINTENANCE e INACTIVE
no la permiten inmediatamente. Esto no garantiza disponibilidad por fechas ni reserva atómica.
Transmisión MANUAL/AUTOMATIC y combustible GASOLINE/DIESEL/HYBRID/ELECTRIC.
Estados Rental: PENDING (solicitud), CONFIRMED (aceptada), ACTIVE (entregada),
COMPLETED (terminada), CANCELLED (cancelada). No se inventan transiciones automáticas.

Convenciones internas iniciales:
- RentalPeriodService acepta fechas de calendario estrictas YYYY-MM-DD (años 0001–9999).
  Se calculan días en UTC, sin DST; el fin es exclusivo: [inicio, fin).
  Mismo día, orden inverso o fechas inválidas se rechazan. Los períodos adyacentes no se solapan.
- periodsOverlap valida ambos períodos y solo compara fechas: vehículo y estados se filtran aparte.
- RentalPricingService exige tarifa positiva con hasta dos decimales; calcula en centavos enteros
  y devuelve unidades monetarias. Rechaza overflow; no redondea entradas con precisión extra.
  No hay impuestos, descuentos, seguros ni moneda implícita.
- Rental.pricePerDay es la tarifa pactada, independiente de cambios posteriores de Vehicle.
  El futuro caso de uso deberá obtener totalAmount mediante el servicio de precios.
- Los errores de estas reglas son RangeError puros. Su traducción a HTTP corresponde
  a la futura capa de aplicación/transporte.

Puertos sin implementaciones: VehicleRepository y RentalRepository para lectura/escritura;
BrandRepository, VehicleModelRepository, CategoryRepository y LocationRepository solo para
resolver referencias. No hay CRUD genérico ni listado sin paginación anticipado.
findOverlapping exige estados explícitos: qué estados bloquean fechas sigue pendiente.
Los puertos no se registran como providers hasta contar con adaptadores.

Pendiente de API-first/producto: moneda, horarios/zona de entrega, fracciones de día,
reglas de cancelación, transiciones de estado, estados que bloquean inventario, validaciones
de matrícula/año/características, filtros/paginación y formato de IDs.
La consistencia entre referencias, unicidad de favoritos y prevención de doble reserva
necesitarán validación de aplicación y garantías atómicas de persistencia; una consulta
de disponibilidad por sí sola no evita carreras. No hay persistencia ni reservas funcionales.

