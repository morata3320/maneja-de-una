import type { DataSource } from 'typeorm';
import { hash } from 'bcrypt';
export const seedId = (n: number): string =>
  '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
export async function seedDevelopment(db: DataSource): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Seed solo para desarrollo/test.');
  await db.transaction(async (m) => {
    for (let i = 1; i <= 3; i++) {
      await m.query(
        'INSERT INTO brands(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [seedId(i), ['Toyota', 'Kia', 'Hyundai'][i - 1]],
      );
      await m.query(
        'INSERT INTO vehicle_models(id,brand_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
        [seedId(10 + i), seedId(i), ['Corolla', 'Sportage', 'Accent'][i - 1]],
      );
      await m.query(
        'INSERT INTO categories(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [seedId(20 + i), ['Sedan', 'SUV', 'Compact'][i - 1]],
      );
      await m.query(
        'INSERT INTO locations(id,name,city,province) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
        [
          seedId(30 + i),
          ['Aeropuerto Quito', 'Centro Quito', 'Aeropuerto Guayaquil'][i - 1],
          i === 3 ? 'Guayaquil' : 'Quito',
          i === 3 ? 'Guayas' : 'Pichincha',
        ],
      );
      await m.query(
        'INSERT INTO suppliers(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [i, 'Proveedor Desarrollo ' + i],
      );
      await m.query(
        'INSERT INTO depots(id,supplier_id,location_id,name,airport,city_id,latitude,longitude) VALUES($1,$1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
        [
          i,
          seedId(30 + i),
          'Agencia Desarrollo ' + i,
          i === 3 ? 'GYE' : 'UIO',
          i === 3 ? 2 : 1,
          i === 3 ? -2.15 : -0.13,
          i === 3 ? -79.88 : -78.35,
        ],
      );
      await m.query(
        'INSERT INTO depot_scores(depot_id,score) VALUES($1,$2) ON CONFLICT(depot_id) DO NOTHING',
        [i, 8 + i / 10],
      );
    }
    for (let i = 1; i <= 16; i++) {
      const group = ((i - 1) % 3) + 1;
      await m.query(
        `INSERT INTO vehicles(id,brand_id,model_id,category_id,location_id,supplier_id,depot_id,year,color,license_plate,transmission,fuel_type,seats,doors,bag_capacity,price_per_day,mileage,description,status)
 VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,4,$13,$14,$15,$16,$17) ON CONFLICT(id) DO NOTHING`,
        [
          seedId(100 + i),
          seedId(group),
          seedId(10 + group),
          seedId(20 + group),
          seedId(30 + group),
          group,
          2022 + (i % 4),
          ['Blanco', 'Azul', 'Gris'][group - 1],
          'DEV-' + String(i).padStart(4, '0'),
          i % 2 ? 'MANUAL' : 'AUTOMATIC',
          ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC'][i % 4],
          i % 4 === 0 ? 7 : 5,
          2 + (i % 3),
          30 + i * 2.5,
          i * 1000,
          'Vehículo de desarrollo ' + i,
          i === 16 ? 'INACTIVE' : i === 15 ? 'MAINTENANCE' : 'AVAILABLE',
        ],
      );
    }
    await m.query(
      "SELECT setval(pg_get_serial_sequence('suppliers','id'),GREATEST((SELECT max(id) FROM suppliers),1))",
    );
    await m.query(
      "SELECT setval(pg_get_serial_sequence('depots','id'),GREATEST((SELECT max(id) FROM depots),1))",
    );
    if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
      await m.query(
        "INSERT INTO users(id,name,first_name,last_name,email,password_hash,role,status) VALUES($1,'Administrador Demo','Administrador','Demo',$2,$3,'ADMIN','ACTIVE') ON CONFLICT(email) DO NOTHING",
        [
          seedId(900),
          process.env.SEED_ADMIN_EMAIL.toLowerCase(),
          await hash(process.env.SEED_ADMIN_PASSWORD, 12),
        ],
      );
    }
    if (process.env.SEED_USER_EMAIL && process.env.SEED_USER_PASSWORD) {
      await m.query(
        "INSERT INTO users(id,name,first_name,last_name,email,password_hash,role,status) VALUES($1,'Usuario Demo','Usuario','Demo',$2,$3,'USER','ACTIVE') ON CONFLICT(email) DO NOTHING",
        [
          seedId(901),
          process.env.SEED_USER_EMAIL.toLowerCase(),
          await hash(process.env.SEED_USER_PASSWORD, 12),
        ],
      );
    }
  });
}
