async function run() {
  if (process.env.RUN_CATALOG_SEED !== 'true') {
    console.log('Seed de catalogo omitido (RUN_CATALOG_SEED != true).');
    return;
  }

  const [dataSourceModule, { seedVehicleCatalog }] = await Promise.all([
    import('./data-source.js'),
    import('./catalog-seed-data.js'),
  ]);
  const db = dataSourceModule.default.default;
  try {
    await db.initialize();
    const created = await seedVehicleCatalog(db);
    console.log(`Seed de catalogo completado: ${created} vehiculos creados.`);
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}

void run().catch(() => {
  console.error('Seed de catalogo opcional fallido.');
  process.exitCode = 1;
});
