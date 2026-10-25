# Despliegue V2

## Desarrollo

```powershell
docker compose up -d postgres
cd apps/api
npm install
npm run migration:run
npm run seed
npm run start:dev
```

Frontend:

```powershell
cd apps/web
npm install
npm run dev
```

## Variables nuevas

- `BOOKING_API_KEY`: opcional, mínimo 32 caracteres; habilita autenticación B2B por header.
- `AUTOS_NODE_ID`: identificador público del nodo.

Render continúa ejecutando migraciones antes de iniciar mediante `start:render`. La migración es aditiva y no requiere cambios manuales en Azure. Probar primero en staging y conservar backup operativo antes de desplegar.
