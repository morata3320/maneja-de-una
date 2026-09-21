import { RentalPricingService } from './rental-pricing.service';
describe('RentalPricingService', () => {
  const service = new RentalPricingService();
  it.each([
    ['2026-09-23', 25, 1, 25],
    ['2026-09-25', 25, 3, 75],
    ['2026-09-25', 19.99, 3, 59.97],
    ['2026-09-25', 0.1, 3, 0.3],
    ['2026-09-23', 0.01, 1, 0.01],
  ])('calcula hasta %s con tarifa %s', (endDate, rate, days, total) => {
    expect(
      service.calculate(
        { startDate: '2026-09-22', endDate: String(endDate) },
        Number(rate),
      ),
    ).toEqual({ days, pricePerDay: rate, totalAmount: total });
  });
  it.each([
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    0.001,
    12.345,
    Number.MAX_VALUE,
    Number.MAX_SAFE_INTEGER,
  ])('rechaza tarifa %s', (rate) =>
    expect(() =>
      service.calculate(
        { startDate: '2026-09-22', endDate: '2026-09-23' },
        rate,
      ),
    ).toThrow(RangeError),
  );
  it('rechaza total fuera de rango seguro', () => {
    expect(() =>
      service.calculate(
        { startDate: '2026-09-22', endDate: '2026-09-25' },
        40000000000000,
      ),
    ).toThrow(RangeError);
  });
  it('no calcula sobre fechas inválidas', () => {
    expect(() =>
      service.calculate({ startDate: '2026-09-22', endDate: '2026-09-22' }, 25),
    ).toThrow(RangeError);
  });
});
