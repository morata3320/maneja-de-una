import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import db from './data-source';

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password) throw new Error('Configurar ambas variables de bootstrap ADMIN.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email ADMIN inválido.');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Password ADMIN inválido.');
  await db.initialize();
  const [existing] = await db.query<Array<{ role: string }>>(
    'SELECT role FROM users WHERE email=$1', [email],
  );
  if (existing) {
    console.log(existing.role === 'ADMIN' ? 'Administrador de demostración disponible.' : 'Email de bootstrap ya pertenece a un usuario; rol preservado.');
    return;
  }
  await db.query(
    `INSERT INTO users(id,name,first_name,last_name,email,password_hash,role,status,active)
     VALUES($1,'Administrador Demo','Administrador','Demo',$2,$3,'ADMIN','ACTIVE',true)
     ON CONFLICT(email) DO NOTHING`,
    [randomUUID(), email, await hash(password, 12)],
  );
  console.log('Administrador de demostración creado.');
}

void run().catch(() => {
  console.error('Bootstrap ADMIN falló; revisar variables y conexión.');
  process.exitCode = 1;
}).finally(async () => { if (db.isInitialized) await db.destroy(); });
