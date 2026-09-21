import type { UserRole } from './user-role';

/** Modelo interno preliminar; no es DTO HTTP ni entidad de persistencia. */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
