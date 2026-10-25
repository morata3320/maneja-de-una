import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AutosRda2Operations1790400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE vehicles
  ADD COLUMN operational_status text NOT NULL DEFAULT 'DISPONIBLE',
  ADD COLUMN next_maintenance_km integer NOT NULL DEFAULT 10000,
  ADD COLUMN fuel_level integer NOT NULL DEFAULT 100,
  ADD CONSTRAINT vehicles_operational_status_check CHECK (operational_status IN ('DISPONIBLE','RESERVADO','LISTO_PARA_ENTREGAR','ENTREGADO','EN_LIMPIEZA','EN_MANTENIMIENTO')),
  ADD CONSTRAINT vehicles_next_maintenance_check CHECK (next_maintenance_km >= 0),
  ADD CONSTRAINT vehicles_fuel_level_check CHECK (fuel_level BETWEEN 0 AND 100);

ALTER TABLE orders
  ADD COLUMN coverage_type text NOT NULL DEFAULT 'BASICA',
  ADD COLUMN digital_checkin_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN returned_at timestamptz,
  ADD COLUMN initial_mileage integer,
  ADD COLUMN final_mileage integer,
  ADD COLUMN delivery_agent text,
  ADD COLUMN refund_reference text,
  ADD CONSTRAINT orders_coverage_check CHECK (coverage_type IN ('BASICA','TOTAL','PREMIUM')),
  ADD CONSTRAINT orders_mileage_check CHECK (initial_mileage IS NULL OR initial_mileage >= 0),
  ADD CONSTRAINT orders_final_mileage_check CHECK (final_mileage IS NULL OR (final_mileage >= 0 AND (initial_mileage IS NULL OR final_mileage >= initial_mileage)));

CREATE TABLE vehicle_cooldowns (
  id uuid PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  UNIQUE(order_id)
);
CREATE INDEX vehicle_cooldowns_active ON vehicle_cooldowns(vehicle_id, ends_at) WHERE completed_at IS NULL;

CREATE TABLE rental_inspections (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  inspection_type text NOT NULL CHECK (inspection_type IN ('ENTREGA','DEVOLUCION')),
  mileage integer NOT NULL CHECK (mileage >= 0),
  fuel_level integer CHECK (fuel_level BETWEEN 0 AND 100),
  body_condition text,
  tire_condition text,
  notes text,
  agent_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, inspection_type)
);

CREATE TABLE maintenance_records (
  id uuid PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  technician_id text NOT NULL,
  mileage integer NOT NULL CHECK (mileage >= 0),
  fuel_level integer NOT NULL CHECK (fuel_level BETWEEN 0 AND 100),
  body_condition text,
  tire_condition text,
  notes text,
  maintenance_performed boolean NOT NULL DEFAULT false,
  next_maintenance_km integer CHECK (next_maintenance_km IS NULL OR next_maintenance_km >= mileage),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_records_vehicle_created ON maintenance_records(vehicle_id, created_at DESC);

CREATE TABLE coverage_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  daily_price numeric(12,2) NOT NULL CHECK (daily_price >= 0),
  deductible numeric(12,2) NOT NULL CHECK (deductible >= 0),
  deposit numeric(12,2) NOT NULL CHECK (deposit >= 0),
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO coverage_plans(code,name,daily_price,deductible,deposit,description) VALUES
 ('BASICA','Protección básica',0,1000,500,'Protección con franquicia y depósito de garantía.'),
 ('TOTAL','Cobertura total',18,0,0,'Cobertura sin franquicia ni depósito.'),
 ('PREMIUM','Cobertura premium',28,0,0,'Cobertura completa y asistencia ampliada.');

CREATE TABLE promotion_agreements (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  allows_promotions boolean NOT NULL DEFAULT false,
  max_discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_percent BETWEEN 0 AND 100),
  enabled_destinations jsonb NOT NULL DEFAULT '[]',
  valid_until date,
  terms text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO promotion_agreements(id) VALUES(true);

CREATE TABLE reservation_status_history (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  from_status text,
  to_status text NOT NULL,
  actor_id text NOT NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_status_history_order ON reservation_status_history(order_id, created_at);
`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Revert deshabilitado en produccion.');
    await queryRunner.query(`
DROP TABLE reservation_status_history;
DROP TABLE promotion_agreements;
DROP TABLE coverage_plans;
DROP TABLE maintenance_records;
DROP TABLE rental_inspections;
DROP TABLE vehicle_cooldowns;
ALTER TABLE orders DROP COLUMN refund_reference, DROP COLUMN delivery_agent, DROP COLUMN final_mileage, DROP COLUMN initial_mileage, DROP COLUMN returned_at, DROP COLUMN delivered_at, DROP COLUMN digital_checkin_at, DROP COLUMN coverage_type;
ALTER TABLE vehicles DROP COLUMN fuel_level, DROP COLUMN next_maintenance_km, DROP COLUMN operational_status;
`);
  }
}
