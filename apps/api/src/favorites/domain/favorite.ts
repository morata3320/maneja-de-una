/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface Favorite {
  readonly id: string;
  readonly userId: string;
  readonly vehicleId: string;
  readonly createdAt: string;
}
