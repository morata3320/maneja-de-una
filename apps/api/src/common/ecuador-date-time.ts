import { BadRequestException } from '@nestjs/common';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ECUADOR_OFFSET = '-05:00';

export function ecuadorDateTime(date: string, time = '10:00'): Date {
  const dateMatch = DATE_ONLY.exec(date);
  const timeMatch = TIME_ONLY.exec(time);
  if (!dateMatch || !timeMatch)
    throw new BadRequestException('Fecha u hora inválida.');
  const value = new Date(`${date}T${time}:00${ECUADOR_OFFSET}`);
  if (!Number.isFinite(value.getTime()))
    throw new BadRequestException('Fecha u hora inválida.');
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    localParts.find((item) => item.type === type)?.value;
  if (
    part('year') !== dateMatch[1] ||
    part('month') !== dateMatch[2] ||
    part('day') !== dateMatch[3] ||
    part('hour') !== timeMatch[1] ||
    part('minute') !== timeMatch[2]
  )
    throw new BadRequestException('Fecha u hora inválida.');
  return value;
}

export function reservationDateTime(
  value: string,
  time = '10:00',
): Date {
  if (DATE_ONLY.test(value)) return ecuadorDateTime(value, time);
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()))
    throw new BadRequestException('Fecha u hora inválida.');
  return instant;
}
