# Contrato canónico de Autos

Source repository: semestre5grupal-ops/Plantilla-Integracion-Sistemas
Source commit: 090e863928579bf90eb21c560b798114bafb2028
Canonical contract: contracts/autos-openapi.yaml
SHA-256: 7ef0fd17b82e2fa24e7efb170f2ec833f905e071b1017cc0bf2741393593ed5b

Archivo original de 30.750 bytes, descargado directamente del commit. No editar.
.gitattributes desactiva la conversión de finales de línea para preservar sus bytes.
La procedencia también está en autos-openapi.source.json.

Desde apps/api:
- npm run contract:check: integridad SHA-256 y validación OpenAPI 3.0.3.
- npm run contract:generate: genera tipos internos de transporte derivados del YAML.
- npm run test:contract: regresión del documento y sincronización de tipos.

Estos checks protegen el documento y sus tipos generados. Las pruebas E2E complementarias
ejecutan los 15 endpoints `/autos/v1` contra PostgreSQL real, validan sus respuestas contra
los schemas canónicos y cubren idempotencia, concurrencia y webhooks persistentes.

Decisiones respetadas por la implementación:
- Son 15 operaciones bajo la base /autos/v1 definida en servers.
- El resto de infraestructura conserva /api/v1 y su formato de errores.
- additionalProperties se permite por defecto, excepto donde el YAML lo prohíbe.
  El ValidationPipe interno no debe rechazar extensiones contractualmente válidas.
- OrderModifyRequest admite {}; CarDetailsRequest no requiere IDs de vehículos.
- Route usa date-time: no aplicar sin adaptación la restricción YYYY-MM-DD del dominio anterior.
- Algunos maximum_results solo son integer, sin mínimo/máximo; no añadir límites de validación.
- La declaración de URI de webhooks no resuelve por sí sola la protección SSRF del envío.
- Producción requiere issuer/audience/JWKS del proveedor OAuth; no están definidos en el YAML.

