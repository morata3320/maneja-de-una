# Despliegue en Render con Azure PostgreSQL

La arquitectura productiva usa dos servicios de Render y conserva PostgreSQL 16 en Azure. No se crea una base de datos en Render.

1. En Render, elegir **New > Blueprint** y conectar este repositorio.
2. Seleccionar la rama `main`; Render detectará `render.yaml`.
3. Completar todos los valores marcados `sync: false`. Definir `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` para el bootstrap idempotente del ADMIN de demostración. No reutilizar secretos entre JWT, paginación y cifrado.
4. Crear `maneja-de-una-api-mdu` y `maneja-de-una-web-mdu`.
5. En el servicio backend, abrir **Connect > Outbound IP ranges** y copiar los rangos reales.
6. En Azure Portal abrir `maneja-de-una-pg > Networking > Firewall rules` y agregar únicamente esos rangos. No abrir `0.0.0.0/0`.
7. Volver a Render y ejecutar un redeploy del backend. `start:render` aplica migraciones pendientes, asegura el ADMIN configurado y después inicia NestJS. Para ampliar el catálogo una vez, definir temporalmente `RUN_CATALOG_SEED=true`: se ejecutará el seed idempotente entre el bootstrap y el inicio de la API. Tras confirmar 29 vehículos y 16 modelos, volver a `RUN_CATALOG_SEED=false` y redeployar. El seed completo de desarrollo nunca se ejecuta.
8. Verificar `https://maneja-de-una-api-mdu.onrender.com/api/v2/health`, luego `/swagger` y `/swagger/autos`.
9. Verificar `https://maneja-de-una-web-mdu.onrender.com` y refrescar rutas como `/vehiculos`, `/checkout/:id`, `/mis-reservas` y `/admin`.
10. Probar registro, login, favorito, reserva, pago simulado y administración.

Sin la regla de firewall, Render no puede conectar con Azure PostgreSQL. Si un nombre de servicio ya existe, elegir otro y actualizar conjuntamente `VITE_API_URL` y `CORS_ORIGINS`. La URL de API de Vite incluye `/api/v2` exactamente una vez.
