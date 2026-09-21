/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface VehicleModel {
  readonly id: string;
  readonly brandId: string;
  readonly name: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
