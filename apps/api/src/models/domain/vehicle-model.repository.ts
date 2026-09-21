import type { VehicleModel } from './vehicle-model';

/** Puerto mínimo para resolver referencias; implementación pendiente. */
export interface VehicleModelRepository {
  findById(id: string): Promise<VehicleModel | null>;
}
