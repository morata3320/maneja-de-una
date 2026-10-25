# Seguridad V2

- JWT interno y JWT de integración usan secretos, issuer y audience separados.
- `X-API-Key` sólo se acepta si `BOOKING_API_KEY` tiene al menos 32 caracteres; comparación constante.
- Los permisos provienen de credenciales verificadas, nunca de `X-Role`.
- Mantenimiento exige `autos:maintenance`; promociones exige `autos:admin`.
- Idempotency-Key UUID v4 obligatorio en creación.
- Correlation ID se propaga a respuestas, historial y outbox.
- DTOs usan whitelist y rechazo de propiedades desconocidas.
- Errores Autos V2 usan `application/problem+json`.
- CORS no admite comodines y Helmet está habilitado.

Pendiente: rotación operacional de API keys y pruebas con el proveedor de identidad real de Booking.
