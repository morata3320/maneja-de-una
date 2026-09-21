import { RentalPeriodService } from './rental-period.service';
import type { RentalPeriod } from './rental-period.service';

export interface RentalPrice {
  readonly days: number;
  readonly pricePerDay: number;
  readonly totalAmount: number;
}

/** Importes en unidades monetarias con hasta dos decimales; moneda pendiente. */
export class RentalPricingService {
  calculate(period: RentalPeriod, pricePerDay: number): RentalPrice {
    const days = new RentalPeriodService().countDays(period);
    if (
      !Number.isFinite(pricePerDay) ||
      pricePerDay <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(pricePerDay))
    ) {
      throw new RangeError(
        'pricePerDay debe ser positivo y tener como máximo dos decimales.',
      );
    }
    const [whole, fraction = ''] = String(pricePerDay).split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    const totalCents = cents * days;
    if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(totalCents)) {
      throw new RangeError('El importe excede el rango seguro de cálculo.');
    }
    return { days, pricePerDay, totalAmount: totalCents / 100 };
  }
}
