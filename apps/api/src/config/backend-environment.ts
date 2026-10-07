export function validateBackendEnvironment(env: NodeJS.ProcessEnv): void {
  for (const key of ['INTERNAL_JWT_SECRET', 'PAGINATION_SECRET']) {
    const value = env[key];
    if (!value || value.length < 32 || value === 'change_me')
      throw new Error(key + ' requiere al menos 32 caracteres.');
  }
  if (!/^[0-9a-f]{64}$/i.test(env.WEBHOOK_ENCRYPTION_KEY ?? ''))
    throw new Error('WEBHOOK_ENCRYPTION_KEY inválida.');
  const mode = env.AUTH_MODE ?? 'jwks';
  if (!['jwks', 'local'].includes(mode))
    throw new Error('AUTH_MODE debe ser jwks o local.');
  if (mode === 'local') {
    if (!env.AUTOS_LOCAL_JWT_SECRET || env.AUTOS_LOCAL_JWT_SECRET.length < 32)
      throw new Error('AUTOS_LOCAL_JWT_SECRET inválido.');
    if (env.INTERNAL_JWT_SECRET === env.AUTOS_LOCAL_JWT_SECRET)
      throw new Error('Separar secretos JWT.');
  } else {
    if (!env.AUTH_ISSUER || !env.AUTH_AUDIENCE || !env.AUTH_JWKS_URL)
      throw new Error('Falta configuración OAuth de producción.');
    if (new URL(env.AUTH_JWKS_URL).protocol !== 'https:')
      throw new Error('JWKS requiere HTTPS.');
  }
  for (const key of [
    'SEARCH_TOKEN_TTL_MINUTES',
    'HOLD_TTL_MINUTES',
    'PREVIEW_TTL_MINUTES',
  ]) {
    if (
      env[key] !== undefined &&
      (!/^\d+$/.test(env[key]!) ||
        Number(env[key]) < 1 ||
        Number(env[key]) > 1440)
    )
      throw new Error(key + ' debe ser entero entre 1 y 1440.');
  }
  if (env.API_DEPRECATION_DATE) {
    const value = env.API_DEPRECATION_DATE;
    const d = new Date(value);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 10) !== value
    )
      throw new Error('API_DEPRECATION_DATE inválida.');
  }
  if (env.PUBLIC_AUTOS_BASE_URL) {
    const url = new URL(env.PUBLIC_AUTOS_BASE_URL);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('PUBLIC_AUTOS_BASE_URL inválida.');
  }
  if (env.NODE_ENV === 'production' && env.WEBHOOK_ALLOW_LOOPBACK === 'true')
    throw new Error('Loopback de webhooks prohibido en producción.');
}
