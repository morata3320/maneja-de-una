import { HealthController } from './health.controller';
describe('HealthController', () => {
  it('identifica el servicio y entrega fecha ISO válida', () => {
    const result = new HealthController().getHealth();
    expect(result).toMatchObject({
      status: 'ok',
      service: 'maneja-de-una-api',
    });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
