import { config } from 'dotenv';
import { SignJWT } from 'jose';
config({ quiet: true });
if (process.env.NODE_ENV === 'production' || process.env.AUTH_MODE !== 'local')
  throw new Error('Solo desarrollo con AUTH_MODE=local.');
const sub = process.argv[process.argv.indexOf('--sub') + 1],
  scopeArg = process.argv[process.argv.indexOf('--scopes') + 1];
if (
  !process.argv.includes('--sub') ||
  !sub ||
  !process.argv.includes('--scopes') ||
  !scopeArg
)
  throw new Error('Usar --sub identificador --scopes autos:read,autos:book');
const scopes = scopeArg.split(',');
if (
  scopes.some(
    (s) =>
      !['autos:read', 'autos:book', 'autos:cancel', 'autos:webhooks'].includes(
        s,
      ),
  )
)
  throw new Error('Scopes inválidos.');
const secret = process.env.AUTOS_LOCAL_JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Secreto local inválido.');
const token = await new SignJWT({ scope: scopes.join(' ') })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(sub)
  .setIssuedAt()
  .setExpirationTime('1h')
  .setIssuer(process.env.AUTH_ISSUER ?? 'urn:autos:local')
  .setAudience(process.env.AUTH_AUDIENCE ?? 'autos-api')
  .sign(new TextEncoder().encode(secret));
console.log(token);
