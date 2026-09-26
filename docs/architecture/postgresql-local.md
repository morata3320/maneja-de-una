# Preparacion local de PostgreSQL 16

Requiere Docker Desktop con motor Linux/WSL2 iniciado. Compose publica PostgreSQL 16 sólo
en `127.0.0.1:5433` para no interferir con una instalación nativa que use 5432. Si ese
puerto está ocupado, se puede cambiar `DB_PORT` en los dos archivos `.env` locales.

1. Copiar `.env.example` de la raíz a `.env` y definir una contraseña local propia.
2. Copiar `apps/api/.env.example` a `apps/api/.env`, repetir la conexión de base y reemplazar todos los secretos de ejemplo.
3. Ejecutar `docker compose up -d` desde la raíz.
4. Verificar con `docker compose ps` y `docker compose exec postgres pg_isready -U maneja_de_una -d maneja_de_una`.
5. En `apps/api`, ejecutar `npm run migration:run` y `npm run seed`.
6. Para detener sin borrar datos: `docker compose stop`.

El proyecto Compose y su volumen estan aislados bajo maneja-de-una. No se modifican
otros contenedores. El puerto solo escucha en loopback.

Las migraciones tienen `synchronize: false`. El seed sólo se admite en development/test y es
idempotente. `npm run test:e2e` crea una base con nombre aleatorio, valida migraciones, seed,
contrato y carreras de concurrencia, y elimina exclusivamente esa base al terminar.

No borrar el volumen como parte del arranque normal. Los `.env` reales están ignorados por Git.
