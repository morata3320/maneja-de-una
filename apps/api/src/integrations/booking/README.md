# Booking futuro

Booking externo consumirá la API REST pública versionada, nunca accederá a la base de datos.
Este módulo solo reserva el contexto: sin endpoints, clientes HTTP ni adaptadores.
Esperar el contrato API-first aprobado antes de implementar la integración.


Necesidades futuras por definir en el contrato público:
- Listar vehículos disponibles y consultar un vehículo.
- Consultar disponibilidad por fechas.
- Crear una reserva/alquiler y consultar su estado.
- Cancelar según las reglas que se aprueben.

Sin rutas definitivas, adaptador HTTP, gRPC ni acceso directo a BD.
