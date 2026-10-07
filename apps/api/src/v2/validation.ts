import { Transform } from 'class-transformer';
import {
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export const Lowercase = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
export const Uppercase = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

export function isEcuadorianCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24 || Number(value[2]) >= 6) return false;
  const digits = value.split('').map(Number);
  const sum = digits.slice(0, 9).reduce((total, digit, index) => {
    const product = digit * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return (10 - (sum % 10)) % 10 === digits[9];
}

export function IsEcuadorianCedula(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isEcuadorianCedula',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isEcuadorianCedula(value),
      defaultMessage: () =>
          'Cédula ecuatoriana inválida',
      },
    });
}

export function cardBrand(
  number: string,
): 'VISA' | 'MASTERCARD' | 'AMEX' | 'UNKNOWN' {
  if (number.startsWith('4')) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(number)) return 'MASTERCARD';
  if (/^3[47]/.test(number)) return 'AMEX';
  return 'UNKNOWN';
}
