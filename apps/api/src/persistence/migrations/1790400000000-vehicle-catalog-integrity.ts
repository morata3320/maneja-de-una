import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Formaliza la compatibilidad de cada modelo con sus categorías y separa la
 * publicación lógica del catálogo de las unidades físicas de inventario.
 */
export class VehicleCatalogIntegrity1790400000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE vehicle_model_categories (
  model_id uuid NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(model_id, category_id)
);

INSERT INTO vehicle_model_categories(model_id, category_id)
SELECT vm.id, c.id
FROM vehicle_models vm
JOIN categories c ON lower(c.name)=lower(CASE lower(vm.name)
  WHEN 'corolla' THEN 'Sedan'
  WHEN 'sportage' THEN 'SUV'
  WHEN 'accent' THEN 'Sedan'
  WHEN 'rav4' THEN 'SUV'
  WHEN 'rio' THEN 'Sedan'
  WHEN 'onix' THEN 'Compact'
  WHEN 'sentra' THEN 'Sedan'
  WHEN 'tucson' THEN 'SUV'
  WHEN 'tracker' THEN 'SUV'
  WHEN 'seltos' THEN 'SUV'
  WHEN 'mazda 3' THEN 'Sedan'
  WHEN 'swift' THEN 'Compact'
  WHEN 'duster' THEN 'SUV'
  WHEN 'ecosport' THEN 'SUV'
  WHEN 't-cross' THEN 'SUV'
  WHEN 'kicks' THEN 'SUV'
END)
WHERE lower(vm.name) IN (
  'corolla','sportage','accent','rav4','rio','onix','sentra','tucson',
  'tracker','seltos','mazda 3','swift','duster','ecosport','t-cross','kicks'
)
ON CONFLICT DO NOTHING;

UPDATE vehicles v
SET category_id=c.id, updated_at=now()
FROM vehicle_models vm
JOIN categories c ON lower(c.name)=lower(CASE lower(vm.name)
  WHEN 'corolla' THEN 'Sedan' WHEN 'sportage' THEN 'SUV'
  WHEN 'accent' THEN 'Sedan' WHEN 'rav4' THEN 'SUV'
  WHEN 'rio' THEN 'Sedan' WHEN 'onix' THEN 'Compact'
  WHEN 'sentra' THEN 'Sedan' WHEN 'tucson' THEN 'SUV'
  WHEN 'tracker' THEN 'SUV' WHEN 'seltos' THEN 'SUV'
  WHEN 'mazda 3' THEN 'Sedan' WHEN 'swift' THEN 'Compact'
  WHEN 'duster' THEN 'SUV' WHEN 'ecosport' THEN 'SUV'
  WHEN 't-cross' THEN 'SUV' WHEN 'kicks' THEN 'SUV'
END)
WHERE v.model_id=vm.id
  AND lower(vm.name) IN (
    'corolla','sportage','accent','rav4','rio','onix','sentra','tucson',
    'tracker','seltos','mazda 3','swift','duster','ecosport','t-cross','kicks'
  )
  AND v.category_id<>c.id;

CREATE TABLE vehicle_publications (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL UNIQUE REFERENCES vehicle_models(id),
  vehicle_id uuid NOT NULL UNIQUE REFERENCES vehicles(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO vehicle_publications(id, model_id, vehicle_id, published_at)
SELECT md5('vehicle-publication:' || ranked.model_id::text)::uuid,
       ranked.model_id, ranked.id, ranked.created_at
FROM (
  SELECT v.*, row_number() OVER (
    PARTITION BY v.model_id ORDER BY v.created_at, v.id
  ) position
  FROM vehicles v
) ranked
WHERE ranked.position=1;

CREATE TABLE vehicle_publication_views (
  publication_id uuid NOT NULL REFERENCES vehicle_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(publication_id, user_id)
);
CREATE INDEX vehicle_publications_latest ON vehicle_publications(published_at DESC);
CREATE INDEX vehicle_publication_views_user ON vehicle_publication_views(user_id);
`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DROP INDEX IF EXISTS vehicle_publication_views_user;
DROP INDEX IF EXISTS vehicle_publications_latest;
DROP TABLE IF EXISTS vehicle_publication_views;
DROP TABLE IF EXISTS vehicle_publications;
DROP TABLE IF EXISTS vehicle_model_categories;
`);
  }
}
