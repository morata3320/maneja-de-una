import db from './data-source';
import { seedDevelopment } from './seed-data';
async function run() {
  try {
    await db.initialize();
    await seedDevelopment(db);
    console.log('Seed determinista completado.');
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
void run().catch(() => {
  console.error('Seed falló. Revisar configuración y migraciones.');
  process.exitCode = 1;
});
