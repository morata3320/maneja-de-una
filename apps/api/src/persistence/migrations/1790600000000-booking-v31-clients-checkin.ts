import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingV31ClientsCheckin1790600000000 implements MigrationInterface {
  name = 'BookingV31ClientsCheckin1790600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE booking_clients (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        identification text NOT NULL,
        phone text NOT NULL,
        license text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT booking_clients_identification_unique UNIQUE(identification)
      );
      CREATE UNIQUE INDEX booking_clients_email_unique
        ON booking_clients(lower(email));

      ALTER TABLE orders
        ADD COLUMN client_id uuid REFERENCES booking_clients(id);
      CREATE INDEX orders_client_id_idx ON orders(client_id);

      CREATE TABLE booking_checkin_notifications (
        order_id uuid PRIMARY KEY REFERENCES orders(id),
        client_id uuid NOT NULL REFERENCES booking_clients(id),
        external_order_id text NOT NULL,
        admin_id text NOT NULL,
        checkin_at timestamptz NOT NULL,
        observations text NOT NULL,
        status text NOT NULL DEFAULT 'PENDING'
          CHECK(status IN ('PENDING','SENDING','ACKNOWLEDGED')),
        attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        last_error text,
        response_payload jsonb,
        acknowledged_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX booking_checkin_notifications_pending_idx
        ON booking_checkin_notifications(next_attempt_at, order_id)
        WHERE status <> 'ACKNOWLEDGED';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Revert deshabilitado en produccion.');
    await queryRunner.query(`
      DROP TABLE booking_checkin_notifications;
      DROP INDEX orders_client_id_idx;
      ALTER TABLE orders DROP COLUMN client_id;
      DROP TABLE booking_clients;
    `);
  }
}
