import type { VehicleStatus, Transmission, FuelType } from './vehicle.enums';

/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface Vehicle {
  readonly id: string;
  readonly brandId: string;
  readonly modelId: string;
  readonly categoryId: string;
  readonly locationId: string;
  readonly year: number;
  readonly color: string;
  readonly licensePlate: string;
  readonly transmission: Transmission;
  readonly fuelType: FuelType;
  readonly seats: number;
  readonly doors: number;
  readonly pricePerDay: number;
  readonly mileage: number;
  readonly description: string;
  readonly status: VehicleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
