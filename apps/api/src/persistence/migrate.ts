import db from './data-source';
async function run() {
  try {
    await db.initialize();
    if (process.argv.includes('--revert')) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('Revert prohibido en producción.');
      await db.undoLastMigration();
    } else await db.runMigrations();
    console.log('Migración completada.');
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
void run().catch(() => {
  console.error('Migración falló; revisar configuración o esquema.');
  process.exitCode = 1;
});
