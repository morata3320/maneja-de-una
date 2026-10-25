# Auditoría inicial V2

Fecha: 2026-10-25. Rama: `feature/rda2-v2-integracion`.

## Componentes verificados

- Backend NestJS 12 + TypeScript, PostgreSQL 16, TypeORM con `synchronize: false`.
- Frontend React 19 + Vite 7 + TypeScript.
- API interna `/api/v1`, marketplace `/api/v2` y contrato Autos legacy `/autos/v1`.
- Seguridad JWT separada para usuarios internos e integración; Helmet, CORS explícito, rate limit y correlation ID.
- Persistencia existente: usuarios, catálogo, flota física, búsquedas, holds, previews, órdenes, pagos mock, idempotencia, favoritos y outbox/webhooks.

## Hallazgos

- El contrato oficial `autos-openapi-v2.yaml` no estaba versionado; fue incorporado sin reemplazar `autos-openapi.yaml`.
- Las 19 operaciones Autos V2 no existían bajo `/api/v2/autos`.
- Ya existían transacciones, advisory locks e idempotencia reutilizables.
- Faltaban promociones, coberturas persistentes, inspecciones, cooldown, mantenimiento e historial operativo.
- El diagrama entregado presupone Supabase y despliegues separados; contradice PostgreSQL Azure y las reglas actuales del repositorio. Se conserva como referencia, no como topología desplegada.

## Resultado del bloque implementado

Se agregó un adaptador REST V2 modular con las 19 operaciones, migración aditiva y pruebas E2E. No se alteraron `/autos/v1`, `/api/v1` ni el contrato canónico legacy.
