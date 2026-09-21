import type { Rental } from './rental';
import type { RentalPeriod } from './rental-period.service';
import type { RentalStatus } from './rental-status';

export interface RentalRepository {
  findById(id: string): Promise<Rental | null>;
  /** Solo estado ACTIVE; no incluye automáticamente CONFIRMED o PENDING. */
  findActiveByVehicle(vehicleId: string): Promise<readonly Rental[]>;
  /** Mismo vehículo, estados explícitos e intervalos [inicio, fin); [] no devuelve resultados. */
  findOverlapping(
    vehicleId: string,
    period: RentalPeriod,
    statuses: readonly RentalStatus[],
  ): Promise<readonly Rental[]>;
  /** Inserta; rechaza ID duplicado. No garantiza atomicidad entre consulta y reserva. */
  save(rental: Rental): Promise<void>;
  /** Sustituye; rechaza ID inexistente. */
  update(rental: Rental): Promise<void>;
}
