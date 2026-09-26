# Backend: monolito modular

NestJS sirve dos superficies HTTP independientes. La API interna vive en `/api/v1` y se
documenta en `/swagger`; la integración API-first vive en `/autos/v1` y sirve el documento
canónico en `/swagger/autos`. El frontend sólo consume HTTP y nunca accede a PostgreSQL.

## Módulos y límites

- `auth`, `favorites` y `admin` forman la API interna. Sus JWT usan emisor, audiencia y secreto propios.
- `integrations/autos` implementa las 15 operaciones contractuales, valida entradas con los esquemas del YAML y verifica OAuth por JWKS en producción.
- `persistence` contiene configuración TypeORM, `EntitySchema`, migraciones y seed. El dominio no contiene decoradores ORM.
- Los módulos de dominio existentes conservan reglas puras de vehículos, alquileres, precios y períodos.

No hay acceso genérico a tablas desde parámetros externos: la administración resuelve una
lista cerrada de recursos, campos, filtros y ordenamientos. Todas las consultas usan parámetros.
Las bajas de catálogo son lógicas para preservar referencias históricas.

## Disponibilidad e idempotencia

Las búsquedas persisten un contexto de corta duración y generan páginas firmadas opacas. Los
holds, previews y órdenes tienen caducidad y propietario. Las operaciones de escritura bloquean
la fila del vehículo dentro de una transacción y vuelven a consultar solapamientos antes de
confirmar. Así, dos solicitudes concurrentes no pueden adquirir el mismo vehículo y período.

Create, modify y cancel exigen `Idempotency-Key`. Una cerradura advisory por propietario,
operación y clave serializa solicitudes concurrentes. Se guarda el hash del payload y la
respuesta; reutilizar la clave con otro payload produce 409.

## Webhooks

Las suscripciones pertenecen al sujeto OAuth. Los secretos se cifran con AES-GCM y nunca se
devuelven después de crearlos. Los eventos se insertan en `webhook_outbox` dentro de la misma
transacción que el cambio principal. Un worker persistente registra cada intento y aplica
reintentos con backoff. La resolución DNS y la conexión validan direcciones públicas para
reducir SSRF; loopback sólo se habilita explícitamente en test.

## Seguridad y configuración

El arranque rechaza secretos ausentes o débiles, secretos JWT compartidos, JWKS sin HTTPS y
modo OAuth local en producción. Las contraseñas internas usan bcrypt con coste 12 y se valida
el límite de 72 bytes. Los errores de `/autos/v1` usan `application/problem+json`; la API
interna conserva el formato uniforme con `requestId`.

Helmet, CORS explícito, límite de cuerpo, Content-Type JSON, validación estricta y rate limiting
son globales. Los logs no incluyen cuerpos, tokens, contraseñas ni configuración secreta.

## Persistencia y validación

PostgreSQL 16 es la única persistencia. TypeORM usa `synchronize: false`; cualquier cambio de
esquema requiere migración reversible. Los importes se almacenan en `numeric`, las relaciones
tienen claves foráneas y favoritos, matrículas, previews e intentos tienen restricciones únicas.

Las pruebas E2E crean una base aislada, ejecutan migración y seed, y cubren contrato, auth,
favoritos, CRUD administrativo, webhooks, reinicio, idempotencia concurrente y doble hold. CI
levanta PostgreSQL 16 y ejecuta lint, verificación contractual, build, migración y todas las pruebas.
