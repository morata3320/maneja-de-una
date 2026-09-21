import type { Category } from './category';

/** Puerto mínimo para resolver referencias; implementación pendiente. */
export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
}
