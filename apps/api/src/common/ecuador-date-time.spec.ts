import { ecuadorDateTime, reservationDateTime } from './ecuador-date-time';

describe('Ecuador reservation date-time', () => {
  it('combines the local date and time using America/Guayaquil', () => {
    expect(ecuadorDateTime('2026-11-26', '10:30').toISOString()).toBe(
      '2026-11-26T15:30:00.000Z',
    );
  });

  it('does not interpret a date-only value as UTC midnight', () => {
    expect(reservationDateTime('2026-11-14').toISOString()).toBe(
      '2026-11-14T15:00:00.000Z',
    );
  });

  it('preserves official ISO instants and rejects invalid calendar dates', () => {
    expect(
      reservationDateTime('2026-11-26T15:30:00.000Z').toISOString(),
    ).toBe('2026-11-26T15:30:00.000Z');
    expect(() => ecuadorDateTime('2026-02-30', '10:00')).toThrow(
      'Fecha u hora inválida.',
    );
  });
});
