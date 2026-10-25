# Arquitectura V2

La implementación actual es un monolito modular NestJS, no 13 microservicios desplegados. Los límites de dominio son:

- Identidad y usuarios.
- Catálogo y flota.
- Reservas, disponibilidad e idempotencia.
- Operación de alquiler: check-in, entrega, devolución y cooldown.
- Mantenimiento.
- Pagos simulados, promociones y outbox.
- Adaptadores `/autos/v1` y `/api/v2/autos`.

El adaptador V2 depende de servicios y persistencia reales. La separación permite extraer módulos más adelante sin duplicar reglas. El diagrama recibido está archivado como `diagrama-referencia-rda2.mermaid`, pero no representa la topología actualmente desplegada.
