import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryStockOutbox1790500000000 implements MigrationInterface {
  name = 'InventoryStockOutbox1790500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_stock_monotonic (
        service_id text NOT NULL,
        item_id text NOT NULL,
        date date NOT NULL,
        time_slot text NOT NULL,
        last_timestamp bigint NOT NULL,
        PRIMARY KEY (service_id, item_id, date, time_slot)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE inventory_stock_outbox (
        id uuid PRIMARY KEY,
        vehicle_id uuid NOT NULL REFERENCES vehicles(id),
        service_id text NOT NULL,
        item_id text NOT NULL,
        date date NOT NULL,
        time_slot text NOT NULL CHECK (time_slot ~ '^([01][0-9]|2[0-3]):(00|30)$'),
        slot_id text NOT NULL,
        available_units integer NOT NULL CHECK (available_units BETWEEN 0 AND 1),
        event_timestamp bigint NOT NULL,
        correlation_id text,
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        last_error text,
        acknowledged_at timestamptz,
        ack_payload jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (service_id, item_id, date, time_slot, event_timestamp)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX inventory_stock_outbox_pending_idx
      ON inventory_stock_outbox(next_attempt_at, id)
      WHERE acknowledged_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_stock_outbox');
    await queryRunner.query('DROP TABLE inventory_stock_monotonic');
  }
}
