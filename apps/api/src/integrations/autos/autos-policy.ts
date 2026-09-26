import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Route } from './contract/autos.types';
import { AutosError } from './autos-error';
import { requiredSecret } from '../../security/token-verifier';
import { RentalPricingService } from '../../rentals/domain/rental-pricing.service';
export function period(route: Route): { start: Date; end: Date; days: number } {
  const start = new Date(route.pickup.datetime),
    end = new Date(route.dropoff.datetime);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  )
    throw new AutosError(
      400,
      'VALIDATION_FAILED',
      'pickup.datetime debe ser anterior a dropoff.datetime.',
    );
  return {
    start,
    end,
    days: Math.ceil((end.getTime() - start.getTime()) / 86400000),
  };
}
export function price(
  route: Route,
  rate: number,
  extras: readonly string[],
): number {
  const { days } = period(route);
  // Adaptación date-time: cada fracción de 24h cuenta como día. El dominio puro conserva fechas de calendario.
  const startDate = '2000-01-01',
    endDate = new Date(Date.UTC(2000, 0, 1) + days * 86400000)
      .toISOString()
      .slice(0, 10);
  const total = new RentalPricingService().calculate(
    { startDate, endDate },
    rate,
  ).totalAmount;
  const extrasTotal = extras.reduce(
    (sum, extra) => sum + (EXTRAS[extra] ?? 0),
    0,
  );
  const cents = Math.round(total * 100) + Math.round(extrasTotal * 100);
  if (cents > 999999999999)
    throw new AutosError(
      400,
      'VALIDATION_FAILED',
      'Importe fuera de capacidad del catálogo.',
    );
  return cents / 100;
}
export const EXTRAS: Record<string, number> = { GPS: 5, CHILD_SEAT: 10 };
export function ttl(name: string, fallback: number): Date {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(name + ' inválido.');
  return new Date(Date.now() + n * 60000);
}
export function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            fingerprint((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export function pageToken(offset: number, context: string): string {
  const payload = Buffer.from(
    JSON.stringify({ offset, context, expires: Date.now() + 3600000 }),
  ).toString('base64url');
  return (
    payload +
    '.' +
    createHmac('sha256', requiredSecret('PAGINATION_SECRET'))
      .update(payload)
      .digest('base64url')
  );
}
export function pageOffset(token: string | undefined, context: string): number {
  if (!token) return 0;
  try {
    const [payload, signature, ...rest] = token.split('.');
    if (rest.length || !payload || !signature) throw new Error();
    const expected = createHmac('sha256', requiredSecret('PAGINATION_SECRET'))
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as { offset: number; context: string; expires: number };
    if (
      decoded.context !== context ||
      decoded.expires < Date.now() ||
      !Number.isSafeInteger(decoded.offset) ||
      decoded.offset < 0
    )
      throw new Error();
    return decoded.offset;
  } catch {
    throw new AutosError(
      400,
      'VALIDATION_FAILED',
      'Token de página inválido o expirado.',
    );
  }
}
export function limitSize(value: number | undefined): number {
  // Fuera de search el contrato no impone mínimo: <=0 se interpreta como página vacía.
  return value === undefined ? 100 : Math.max(0, value);
}
