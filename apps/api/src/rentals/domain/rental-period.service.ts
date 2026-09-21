export interface RentalPeriod {
  /** Fecha de calendario ISO YYYY-MM-DD; inicio incluido y fin excluido. */
  readonly startDate: string;
  readonly endDate: string;
}

const DAY_MS = 86400000;

function calendarDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    throw new RangeError(
      'La fecha debe usar YYYY-MM-DD con año entre 0001 y 9999.',
    );
  }
  const parsed = Date.parse(value + 'T00:00:00.000Z');
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError('Fecha de calendario inválida.');
  }
  return parsed;
}

function bounds(period: RentalPeriod): readonly [number, number] {
  const start = calendarDate(period.startDate);
  const end = calendarDate(period.endDate);
  if (start >= end)
    throw new RangeError('startDate debe ser anterior a endDate.');
  return [start, end];
}

/** Función pura; períodos adyacentes NO se solapan. */
export function periodsOverlap(a: RentalPeriod, b: RentalPeriod): boolean {
  const [aStart, aEnd] = bounds(a);
  const [bStart, bEnd] = bounds(b);
  return aStart < bEnd && bStart < aEnd;
}

export class RentalPeriodService {
  countDays(period: RentalPeriod): number {
    const [start, end] = bounds(period);
    return (end - start) / DAY_MS;
  }
}
