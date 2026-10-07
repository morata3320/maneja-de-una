import type { DataSource, EntityManager } from 'typeorm';

const catalogSeedId = (n: number): string =>
  '10000000-0000-4000-8000-' + String(n).padStart(12, '0');

type CatalogVehicle = {
  brand: string;
  model: string;
  year: number;
  color: string;
  transmission: 'AUTOMATIC' | 'MANUAL';
  fuelType: 'GASOLINE' | 'HYBRID';
  category: 'Sedan' | 'SUV' | 'Compact';
  pricePerDay: number;
  mileage: number;
  licensePlate: string;
};

export const expandedCatalog: readonly CatalogVehicle[] = [
  {
    brand: 'Toyota',
    model: 'RAV4',
    year: 2025,
    color: 'Blanco',
    transmission: 'AUTOMATIC',
    fuelType: 'HYBRID',
    category: 'SUV',
    pricePerDay: 68,
    mileage: 4200,
    licensePlate: 'MDU-RAV4',
  },
  {
    brand: 'Kia',
    model: 'Rio',
    year: 2024,
    color: 'Azul',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'Sedan',
    pricePerDay: 34,
    mileage: 11800,
    licensePlate: 'MDU-RIO',
  },
  {
    brand: 'Chevrolet',
    model: 'Onix',
    year: 2024,
    color: 'Rojo',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'Compact',
    pricePerDay: 36,
    mileage: 9600,
    licensePlate: 'MDU-ONIX',
  },
  {
    brand: 'Nissan',
    model: 'Sentra',
    year: 2025,
    color: 'Gris',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'Sedan',
    pricePerDay: 47,
    mileage: 5100,
    licensePlate: 'MDU-SENTRA',
  },
  {
    brand: 'Hyundai',
    model: 'Tucson',
    year: 2025,
    color: 'Blanco',
    transmission: 'AUTOMATIC',
    fuelType: 'HYBRID',
    category: 'SUV',
    pricePerDay: 64,
    mileage: 3800,
    licensePlate: 'MDU-TUCSON',
  },
  {
    brand: 'Chevrolet',
    model: 'Tracker',
    year: 2024,
    color: 'Gris',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 52,
    mileage: 12700,
    licensePlate: 'MDU-TRACKER',
  },
  {
    brand: 'Kia',
    model: 'Seltos',
    year: 2025,
    color: 'Blanco',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 58,
    mileage: 4600,
    licensePlate: 'MDU-SELTOS',
  },
  {
    brand: 'Mazda',
    model: 'Mazda 3',
    year: 2025,
    color: 'Azul',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'Sedan',
    pricePerDay: 54,
    mileage: 3200,
    licensePlate: 'MDU-MAZDA3',
  },
  {
    brand: 'Suzuki',
    model: 'Swift',
    year: 2024,
    color: 'Rojo',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    category: 'Compact',
    pricePerDay: 31,
    mileage: 14300,
    licensePlate: 'MDU-SWIFT',
  },
  {
    brand: 'Renault',
    model: 'Duster',
    year: 2024,
    color: 'Gris',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 45,
    mileage: 16600,
    licensePlate: 'MDU-DUSTER',
  },
  {
    brand: 'Ford',
    model: 'EcoSport',
    year: 2023,
    color: 'Blanco',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 43,
    mileage: 24800,
    licensePlate: 'MDU-ECOSPT',
  },
  {
    brand: 'Volkswagen',
    model: 'T-Cross',
    year: 2025,
    color: 'Azul',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 59,
    mileage: 2900,
    licensePlate: 'MDU-TCROSS',
  },
  {
    brand: 'Nissan',
    model: 'Kicks',
    year: 2025,
    color: 'Blanco',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    category: 'SUV',
    pricePerDay: 57,
    mileage: 3500,
    licensePlate: 'MDU-KICKS',
  },
];

type IdRow = { id: string };
type DepotRow = { id: number; supplier_id: number; location_id: string };

async function findOrCreateNamed(
  manager: EntityManager,
  table: 'brands' | 'categories',
  id: string,
  name: string,
): Promise<string> {
  const [existing] = await manager.query<IdRow[]>(
    `SELECT id FROM ${table} WHERE lower(name)=lower($1) ORDER BY id LIMIT 1`,
    [name],
  );
  if (existing) return existing.id;
  const columns =
    table === 'categories' ? '(id,name,description)' : '(id,name)';
  const values = table === 'categories' ? "($1,$2,'')" : '($1,$2)';
  await manager.query(
    `INSERT INTO ${table}${columns} VALUES${values} ON CONFLICT(id) DO NOTHING`,
    [id, name],
  );
  const [created] = await manager.query<IdRow[]>(
    `SELECT id FROM ${table} WHERE lower(name)=lower($1) ORDER BY id LIMIT 1`,
    [name],
  );
  if (!created) throw new Error(`No se pudo preparar ${table}: ${name}`);
  return created.id;
}

async function findOrCreateModel(
  manager: EntityManager,
  id: string,
  brandId: string,
  name: string,
): Promise<string> {
  const [existing] = await manager.query<IdRow[]>(
    'SELECT id FROM vehicle_models WHERE brand_id=$1 AND lower(name)=lower($2) ORDER BY id LIMIT 1',
    [brandId, name],
  );
  if (existing) return existing.id;
  await manager.query(
    'INSERT INTO vehicle_models(id,brand_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
    [id, brandId, name],
  );
  const [created] = await manager.query<IdRow[]>(
    'SELECT id FROM vehicle_models WHERE brand_id=$1 AND lower(name)=lower($2) ORDER BY id LIMIT 1',
    [brandId, name],
  );
  if (!created) throw new Error(`No se pudo preparar el modelo: ${name}`);
  return created.id;
}

async function expandVehicleCatalog(manager: EntityManager): Promise<number> {
  await manager.query(
    "SELECT pg_advisory_xact_lock(hashtext('maneja-de-una:vehicle-catalog:v1'))",
  );
  const deterministicBrandIds: Record<string, number> = {
    Toyota: 1,
    Kia: 2,
    Hyundai: 3,
    Chevrolet: 4,
    Nissan: 5,
    Mazda: 6,
    Suzuki: 7,
    Renault: 8,
    Ford: 9,
    Volkswagen: 10,
  };
  const brandIds = new Map<string, string>();
  for (const name of new Set(expandedCatalog.map(({ brand }) => brand)))
    brandIds.set(
      name,
      await findOrCreateNamed(
        manager,
        'brands',
        catalogSeedId(deterministicBrandIds[name]),
        name,
      ),
    );

  const categoryIds = new Map<string, string>();
  for (const [index, name] of ['Sedan', 'SUV', 'Compact'].entries())
    categoryIds.set(
      name,
      await findOrCreateNamed(
        manager,
        'categories',
        catalogSeedId(21 + index),
        name,
      ),
    );

  const depots = await manager.query<DepotRow[]>(
    `SELECT d.id,d.supplier_id,d.location_id
     FROM depots d
     JOIN suppliers s ON s.id=d.supplier_id
     JOIN locations l ON l.id=d.location_id
     WHERE d.active=true AND s.active=true AND l.active=true
     ORDER BY CASE l.name WHEN 'Aeropuerto Quito' THEN 1 WHEN 'Centro Quito' THEN 2 WHEN 'Aeropuerto Guayaquil' THEN 3 ELSE 4 END,d.id`,
  );
  if (!depots.length)
    throw new Error('No hay depots activos para asignar el catalogo.');

  let created = 0;
  for (const [index, vehicle] of expandedCatalog.entries()) {
    const brandId = brandIds.get(vehicle.brand)!;
    const modelId = await findOrCreateModel(
      manager,
      catalogSeedId(14 + index),
      brandId,
      vehicle.model,
    );
    const vehicleId = catalogSeedId(117 + index);
    const [existing] = await manager.query<IdRow[]>(
      'SELECT id FROM vehicles WHERE id=$1 OR license_plate=$2 LIMIT 1',
      [vehicleId, vehicle.licensePlate],
    );
    if (existing) continue;
    const depot = depots[index % depots.length];
    await manager.query(
      `INSERT INTO vehicles(id,brand_id,model_id,category_id,location_id,supplier_id,depot_id,year,color,license_plate,transmission,fuel_type,seats,doors,bag_capacity,price_per_day,mileage,description,status,active)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,5,4,2,$13,$14,$15,'AVAILABLE',true)`,
      [
        vehicleId,
        brandId,
        modelId,
        categoryIds.get(vehicle.category),
        depot.location_id,
        depot.supplier_id,
        depot.id,
        vehicle.year,
        vehicle.color,
        vehicle.licensePlate,
        vehicle.transmission,
        vehicle.fuelType,
        vehicle.pricePerDay,
        vehicle.mileage,
        `${vehicle.brand} ${vehicle.model} de demostracion`,
      ],
    );
    created++;
  }
  return created;
}

export async function seedVehicleCatalog(db: DataSource): Promise<number> {
  return db.transaction(expandVehicleCatalog);
}
