import { cardBrand, isEcuadorianCedula, luhnValid } from './validation';

describe('validaciones de marketplace V2', () => {
  it('acepta cedulas ecuatorianas con provincia, tercer digito y checksum validos', () => {
    expect(isEcuadorianCedula('1710034065')).toBe(true);
  });
  it.each(['1710034064', '0010034065', '2560034065', '1760034065', '1111111111', '17100 4065'])(
    'rechaza cedula invalida %s',
    (value) => expect(isEcuadorianCedula(value)).toBe(false),
  );
  it('aplica Luhn y detecta marcas sin conservar datos', () => {
    const validVisa = '42'.repeat(8);
    expect(luhnValid(validVisa)).toBe(true);
    expect(cardBrand(validVisa)).toBe('VISA');
    expect(luhnValid(validVisa.slice(0, -1) + '1')).toBe(false);
  });
});
