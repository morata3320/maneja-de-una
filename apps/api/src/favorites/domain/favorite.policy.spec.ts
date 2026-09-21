import { canAddFavorite } from './favorite.policy';
describe('Favorite: unicidad conceptual', () => {
  const candidate = { userId: 'u1', vehicleId: 'v1' };
  it('permite el primer favorito', () =>
    expect(canAddFavorite(candidate, [])).toBe(true));
  it('rechaza duplicado del mismo par', () =>
    expect(canAddFavorite(candidate, [candidate])).toBe(false));
  it('permite otro vehículo', () =>
    expect(canAddFavorite(candidate, [{ userId: 'u1', vehicleId: 'v2' }])).toBe(
      true,
    ));
  it('permite otro usuario', () =>
    expect(canAddFavorite(candidate, [{ userId: 'u2', vehicleId: 'v1' }])).toBe(
      true,
    ));
});
