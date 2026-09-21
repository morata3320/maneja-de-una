import type { Vehicle } from './vehicle';

export interface VehicleRepository {
  findById(id: string): Promise<Vehicle | null>;
  /** Inserta una unidad nueva; rechaza ID duplicado. No es upsert. */
  save(vehicle: Vehicle): Promise<void>;
  /** Sustituye una unidad existente; rechaza ID inexistente. */
  update(vehicle: Vehicle): Promise<void>;
}
