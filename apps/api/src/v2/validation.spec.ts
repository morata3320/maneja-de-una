import { cardBrand, isEcuadorianCedula } from './validation';

describe('validaciones de marketplace V2', () => {
  it('acepta cedulas ecuatorianas con provincia, tercer digito y checksum validos', () => {
    expect(isEcuadorianCedula('1710034065')).toBe(true);
  });
  it.each([
    '1710034064',
    '0010034065',
    '2560034065',
    '1760034065',
    '1111111111',
    '17100 4065',
  ])('rechaza cedula invalida %s', (value) =>
    expect(isEcuadorianCedula(value)).toBe(false),
  );
  it('detecta marcas conocidas y usa UNKNOWN para tarjetas demo', () => {
    expect(cardBrand('42'.repeat(8))).toBe('VISA');
    expect(cardBrand('1'.repeat(15))).toBe('UNKNOWN');
  });
});
