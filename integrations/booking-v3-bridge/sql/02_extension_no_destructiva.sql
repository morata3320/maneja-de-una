-- Extensión PARA PRUEBAS V3; no modifica tablas public de MANEJA DE UNA V2.
-- Requiere antes el archivo maestro original sin cambios.
CREATE TABLE IF NOT EXISTS booking.integration_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  request_sha256 TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS booking.stock_sync_outbox (
  seq BIGSERIAL PRIMARY KEY,
  service_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  available_units INTEGER NOT NULL CHECK (available_units BETWEEN 0 AND 1),
  event_timestamp BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_sync_outbox_pending_idx
  ON booking.stock_sync_outbox(seq) WHERE acknowledged_at IS NULL;
CREATE TABLE IF NOT EXISTS booking.stock_sync_monotonic (
  service_id TEXT NOT NULL, item_id TEXT NOT NULL, date TEXT NOT NULL, time_slot TEXT NOT NULL,
  last_timestamp BIGINT NOT NULL,
  PRIMARY KEY(service_id,item_id,date,time_slot)
);
CREATE TABLE IF NOT EXISTS booking.bridge_audit (
  id BIGSERIAL PRIMARY KEY,
  correlation_id TEXT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nota: Los 4 esquemas originales son la referencia unificada recibida.
-- Los tres objetos nuevos son únicamente de integración y no reemplazan el modelo maestro.
