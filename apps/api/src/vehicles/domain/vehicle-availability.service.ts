import type { Vehicle } from './vehicle';
import { VehicleStatus } from './vehicle.enums';

/** Solo elegibilidad por estado; no garantiza disponibilidad por fechas. */
export class VehicleAvailabilityService {
  canEvaluateReservation(vehicle: Pick<Vehicle, 'status'>): boolean {
    return vehicle.status === VehicleStatus.AVAILABLE;
  }
}
