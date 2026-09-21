import type { RentalStatus } from './rental-status';

/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface Rental {
  readonly id: string;
  readonly vehicleId: string;
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly pricePerDay: number;
  readonly totalAmount: number;
  readonly status: RentalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
