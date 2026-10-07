import { validateBackendEnvironment } from './backend-environment';
const valid = () => ({
  NODE_ENV: 'test',
  AUTH_MODE: 'local',
  INTERNAL_JWT_SECRET: 'a'.repeat(48),
  AUTOS_LOCAL_JWT_SECRET: 'b'.repeat(48),
  PAGINATION_SECRET: 'c'.repeat(48),
  WEBHOOK_ENCRYPTION_KEY: 'ab'.repeat(32),
});
describe('Configuración backend segura', () => {
  it('admite desarrollo explícito', () =>
    expect(() => validateBackendEnvironment(valid())).not.toThrow());
  it.each([
    { AUTH_MODE: 'none' },
    { AUTH_MODE: 'jwks' },
    { HOLD_TTL_MINUTES: '0' },
    { PREVIEW_TTL_MINUTES: 'NaN' },
    { WEBHOOK_ENCRYPTION_KEY: 'change_me' },
    { INTERNAL_JWT_SECRET: 'short' },
    { API_DEPRECATION_DATE: '2026-02-30' },
    { PUBLIC_AUTOS_BASE_URL: 'ftp://example.com' },
  ])('rechaza configuración %j', (change) =>
    expect(() =>
      validateBackendEnvironment({ ...valid(), ...change }),
    ).toThrow(),
  );
  it('admite modo local académico en producción con secretos separados', () =>
    expect(() =>
      validateBackendEnvironment({ ...valid(), NODE_ENV: 'production' }),
    ).not.toThrow());
  it('admite JWKS de producción sin modo local', () =>
    expect(() =>
      validateBackendEnvironment({
        ...valid(),
        NODE_ENV: 'production',
        AUTH_MODE: 'jwks',
        AUTH_JWKS_URL: 'https://auth.example/jwks',
        AUTH_ISSUER: 'issuer',
        AUTH_AUDIENCE: 'autos',
      }),
    ).not.toThrow());
});
