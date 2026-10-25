# Límites de servicios

| Dominio objetivo | Implementación actual | Estado |
|---|---|---|
| Usuarios, catálogo, favoritos | Módulos NestJS | FUNCIONAL |
| Disponibilidad y reservas | Módulos + transacciones PostgreSQL | FUNCIONAL |
| Operación de flota y mantenimiento | Adaptador Autos V2 + tablas dedicadas | FUNCIONAL |
| Pagos | Adaptador REST mock explícito | PARCIAL |
| Notificaciones/webhooks | Outbox persistente y worker HTTP | FUNCIONAL |
| Gateway/ESB | No desplegados; filtros/guards actúan como perímetro local | PENDIENTE |
| 13 procesos independientes | No implementados por restricción vigente del repositorio | PENDIENTE |

Los módulos no se presentan como microservicios independientes. Su extracción futura requiere ownership de datos, despliegue, observabilidad y contratos internos propios.
