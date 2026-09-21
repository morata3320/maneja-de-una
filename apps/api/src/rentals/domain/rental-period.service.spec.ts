import { RentalPeriodService, periodsOverlap } from './rental-period.service';
const period = (startDate: string, endDate: string) => ({ startDate, endDate });
describe('RentalPeriodService', () => {
  const service = new RentalPeriodService();
  it.each([
    ['2026-09-22', '2026-09-23', 1],
    ['2026-09-22', '2026-09-25', 3],
    ['2024-02-28', '2024-03-01', 2],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-03-07', '2026-03-09', 2],
    ['0099-12-31', '0100-01-01', 1],
  ])('calcula días entre %s y %s', (start, end, days) => {
    expect(service.countDays(period(String(start), String(end)))).toBe(days);
  });
  it.each([
    ['2026-09-22', '2026-09-22'],
    ['2026-09-25', '2026-09-22'],
    ['bad', '2026-09-25'],
    ['2026-09-22', 'bad'],
    ['2026-02-30', '2026-03-02'],
    ['2026-02-29', '2026-03-02'],
    ['2026-09-22', '2026-13-01'],
    ['', '2026-09-25'],
    ['2026-9-22', '2026-09-25'],
    ['0000-01-01', '2026-09-25'],
    ['2026-09-22T12:00:00Z', '2026-09-25'],
    ['2026-09-22', '2026-09-25T00:00:00-05:00'],
  ])('rechaza período %s a %s', (start, end) => {
    expect(() => service.countDays(period(start, end))).toThrow(RangeError);
  });
});
describe('periodsOverlap: intervalos semiabiertos', () => {
  const a = period('2026-09-22', '2026-09-25');
  it.each([
    ['2026-09-26', '2026-09-29', false],
    ['2026-09-19', '2026-09-21', false],
    ['2026-09-24', '2026-09-27', true],
    ['2026-09-20', '2026-09-23', true],
    ['2026-09-23', '2026-09-24', true],
    ['2026-09-20', '2026-09-27', true],
    ['2026-09-22', '2026-09-25', true],
    ['2026-09-25', '2026-09-29', false],
    ['2026-09-19', '2026-09-22', false],
    ['2026-09-22', '2026-09-24', true],
    ['2026-09-23', '2026-09-25', true],
  ])('solapamiento simétrico con %s a %s', (start, end, expected) => {
    const b = period(String(start), String(end));
    expect(periodsOverlap(a, b)).toBe(expected);
    expect(periodsOverlap(b, a)).toBe(expected);
  });
  it.each([
    period('bad', '2026-09-25'),
    period('2026-09-22', 'bad'),
    period('2026-09-22', '2026-09-22'),
    period('2026-09-25', '2026-09-22'),
  ])('valida ambos operandos: %j', (invalid) => {
    expect(() => periodsOverlap(invalid, a)).toThrow(RangeError);
    expect(() => periodsOverlap(a, invalid)).toThrow(RangeError);
  });
});
