/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface Location {
  readonly id: string;
  readonly city: string;
  readonly province: string;
  readonly name: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
