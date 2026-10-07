import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketplaceV21790300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE users ADD COLUMN first_name text;
ALTER TABLE users ADD COLUMN last_name text;
ALTER TABLE users ADD COLUMN cedula text;
ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE';
UPDATE users SET first_name=COALESCE(NULLIF(split_part(trim(name),' ',1),''),'Usuario'), last_name=COALESCE(NULLIF(trim(substr(name,length(split_part(trim(name),' ',1))+1)),''),'-');
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role='USER' WHERE role='CUSTOMER';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('USER','ADMIN'));
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK(status IN ('ACTIVE','INACTIVE','SUSPENDED'));
ALTER TABLE users ADD CONSTRAINT users_cedula_unique UNIQUE(cedula);
ALTER TABLE orders ALTER COLUMN preview_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_reference DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('CONFIRMED','CANCELLED','PENDING','COMPLETED'));
CREATE TABLE payments (
 id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES orders(id), user_id uuid NOT NULL REFERENCES users(id),
 amount numeric(12,2) NOT NULL CHECK(amount>0), currency text NOT NULL DEFAULT 'USD',
 status text NOT NULL CHECK(status IN ('APPROVED','DECLINED')), method text NOT NULL DEFAULT 'CARD',
 card_brand text NOT NULL, card_last4 varchar(4) NOT NULL CHECK(card_last4 ~ '^[0-9]{4}$'),
 payment_reference text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_created ON payments(user_id,created_at DESC);
CREATE INDEX orders_user_created ON orders(owner_id,created_at DESC);
`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production') throw new Error('Revert deshabilitado en produccion.');
    await queryRunner.query(`
DROP INDEX IF EXISTS orders_user_created;
DROP TABLE payments;
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
UPDATE orders SET status='CONFIRMED' WHERE status='COMPLETED';
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('CONFIRMED','CANCELLED','PENDING'));
ALTER TABLE orders ALTER COLUMN preview_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_reference SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_cedula_unique;
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users DROP CONSTRAINT users_role_check;
UPDATE users SET role='CUSTOMER' WHERE role='USER';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('CUSTOMER','ADMIN'));
ALTER TABLE users DROP COLUMN status, DROP COLUMN phone, DROP COLUMN cedula, DROP COLUMN last_name, DROP COLUMN first_name;
`);
  }
}
