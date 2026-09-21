export function validateEnvironment(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnv)
  ) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }
  const port = positiveInteger(env.PORT ?? 3000, 'PORT', 65535);
  const rawOrigins = env.CORS_ORIGINS ?? 'http://localhost:5173';
  if (typeof rawOrigins !== 'string' || !rawOrigins.trim()) {
    throw new Error('CORS_ORIGINS debe contener al menos un origen HTTP(S).');
  }
  const origins = rawOrigins.split(',').map((origin) => origin.trim());
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin ||
        url.username ||
        url.password ||
        origin.includes('*')
      )
        throw new Error();
    } catch {
      throw new Error(
        'CORS_ORIGINS debe contener orígenes HTTP(S) explícitos separados por comas, sin rutas ni comodines.',
      );
    }
  }
  return {
    ...env,
    NODE_ENV: nodeEnv,
    PORT: port,
    CORS_ORIGINS: origins.join(','),
    RATE_LIMIT_TTL_MS: positiveInteger(
      env.RATE_LIMIT_TTL_MS ?? 60000,
      'RATE_LIMIT_TTL_MS',
      2147483647,
    ),
    RATE_LIMIT_MAX: positiveInteger(
      env.RATE_LIMIT_MAX ?? 100,
      'RATE_LIMIT_MAX',
      1000000,
    ),
  };
}

function positiveInteger(value: unknown, name: string, max: number): number {
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > max
  ) {
    throw new Error(name + ' debe ser un entero entre 1 y ' + max + '.');
  }
  return Number(value);
}
