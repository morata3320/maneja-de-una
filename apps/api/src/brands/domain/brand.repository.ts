import type { Brand } from './brand';

/** Puerto mínimo para resolver referencias; implementación pendiente. */
export interface BrandRepository {
  findById(id: string): Promise<Brand | null>;
}
