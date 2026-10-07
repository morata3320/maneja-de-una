# Defensa técnica — Maneja de Una

Maneja de Una es un marketplace REST para buscar, reservar y pagar de forma simulada el alquiler de vehículos. El frontend aplica MVC pragmático: modelos tipados, servicios HTTP centralizados, hooks/controladores de estado y vistas React. El backend NestJS separa controllers, DTOs, guards, servicios, persistencia TypeORM y entidades.

REST mantiene contratos simples sobre HTTP: GET consulta, POST crea o ejecuta acciones, PUT reemplaza, PATCH modifica parcialmente y DELETE elimina o desactiva. `/api/v2` permite evolucionar sin romper `/api/v1` ni el contrato API-first `/autos/v1`; el detalle de vehículo incluye enlaces HATEOAS. Se usan 200/201/204 para éxito y 400/401/403/404/409 según validación, autenticación, autorización, ausencia o conflicto.

PostgreSQL 16 conserva integridad y TypeORM aplica migraciones con `synchronize=false`. JWT autentica; 401 significa identidad ausente o inválida y 403 identidad válida sin permiso. `USER` compra y `ADMIN` gestiona. bcrypt protege contraseñas. CORS restringe el frontend productivo, Helmet y rate limiting reducen superficie OWASP. La cédula ecuatoriana se valida localmente por formato, provincia, tercer dígito y Mod10.

El pago es una simulación: valida formato, longitud, expiración y CVV, pero jamás persiste PAN ni CVV; solo marca, últimos cuatro y referencia. No aplica Luhn ni procesamiento bancario. Swagger/OpenAPI permite demostrar el contrato. GitHub Actions ejecuta lint, compilación y tests con PostgreSQL aislado; Render aloja web/API y se conecta a Azure mediante firewall restringido.

## Demo en menos de 5 minutos

1. Abrir Swagger y health; explicar versionamiento y autenticación.
2. Registrar un USER, iniciar sesión y autorizar el JWT.
3. Buscar un vehículo, agregar favorito y crear reserva.
4. Ejecutar pago simulado y mostrar referencia sin PAN/CVV.
5. Ingresar como ADMIN: dashboard, CRUD de catálogo/vehículos/clientes, reservas y pagos de solo lectura; cerrar con CI y `/autos/v1` como integración contractual futura.

No se usa GraphQL, gRPC ni SOAP actualmente; tampoco microservicios o mensajería. Son opciones futuras solo si la escala y los contratos lo justifican.
