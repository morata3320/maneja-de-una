import type { Location } from './location';

/** Puerto mínimo para resolver referencias; implementación pendiente. */
export interface LocationRepository {
  findById(id: string): Promise<Location | null>;
}
