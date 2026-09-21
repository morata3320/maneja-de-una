import type { Favorite } from './favorite';

/** Prechequeo local; la persistencia deberá garantizar UNIQUE(userId, vehicleId). */
export function canAddFavorite(
  candidate: Pick<Favorite, 'userId' | 'vehicleId'>,
  existing: readonly Pick<Favorite, 'userId' | 'vehicleId'>[],
): boolean {
  return !existing.some(
    (item) =>
      item.userId === candidate.userId &&
      item.vehicleId === candidate.vehicleId,
  );
}
