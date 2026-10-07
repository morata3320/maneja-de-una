import db from './data-source';
import { seedVehicleCatalog } from './catalog-seed-data';

async function run() {
  try {
    await db.initialize();
    const created = await seedVehicleCatalog(db);
    const [summary] = await db.query<
      Array<{ vehicles: string; models: string; brands: string }>
    >(`SELECT
         (SELECT count(*) FROM vehicles) vehicles,
         (SELECT count(DISTINCT model_id) FROM vehicles) models,
         (SELECT count(*) FROM brands) brands`);
    console.log(
      `Catalogo completado: ${created} vehiculos creados; ${summary.vehicles} vehiculos, ${summary.models} modelos en uso, ${summary.brands} marcas.`,
    );
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}

void run().catch(() => {
  console.error(
    'Ampliacion de catalogo fallida. Revisar conexion y migraciones.',
  );
  process.exitCode = 1;
});
