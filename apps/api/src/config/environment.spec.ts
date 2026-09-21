import { validateEnvironment } from './environment';
describe('Environment', () => {
  it('normaliza valores válidos y aplica defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      RATE_LIMIT_MAX: 100,
      RATE_LIMIT_TTL_MS: 60000,
    });
    expect(
      validateEnvironment({
        PORT: '8080',
        CORS_ORIGINS: 'https://a.example, http://localhost:5173',
      }),
    ).toMatchObject({
      PORT: 8080,
      CORS_ORIGINS: 'https://a.example,http://localhost:5173',
    });
  });
  it.each([
    { NODE_ENV: 'staging' },
    { PORT: 'abc' },
    { PORT: '3.5' },
    { PORT: 0 },
    { PORT: 65536 },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: '' },
    { CORS_ORIGINS: 'https://example.com/path' },
    { CORS_ORIGINS: 'https://u:p@example.com' },
    { CORS_ORIGINS: 'https://example.com,' },
    { CORS_ORIGINS: 'ftp://example.com' },
    { RATE_LIMIT_MAX: 0 },
    { RATE_LIMIT_TTL_MS: '-1' },
  ])('rechaza %j', (env) => expect(() => validateEnvironment(env)).toThrow());
});
