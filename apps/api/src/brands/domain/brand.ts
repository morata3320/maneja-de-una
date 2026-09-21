/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
