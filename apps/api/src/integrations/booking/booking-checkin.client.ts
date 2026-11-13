import { Injectable } from '@nestjs/common';

export type BookingCheckinPayload = {
  booking_code: string;
  staff_user: string;
  fecha_checkin: string;
  licencia_conducir: string;
  km_salida: number;
  documento_identidad?: string;
};

export type BookingCheckinAck = {
  acknowledged: true;
  status: 'CONFIRMADO_ASISTIDO';
  voucher?: Record<string, unknown>;
  [key: string]: unknown;
};

type BookingCheckinEndpointVersion = 'v1' | 'v3';
type BookingCheckinV1Action = 'checkin' | 'checkin-entrega';

@Injectable()
export class BookingCheckinClient {
  isEnabled(): boolean {
    return (
      process.env.BOOKING_CHECKIN_ENABLED === 'true' &&
      Boolean(process.env.BOOKING_CHECKIN_API_KEY)
    );
  }

  async notify(
    payload: BookingCheckinPayload,
    correlationId: string,
  ): Promise<BookingCheckinAck> {
    if (!this.isEnabled()) throw new Error('BOOKING_CHECKIN_DISABLED');
    const apiKey = process.env.BOOKING_CHECKIN_API_KEY;
    if (!apiKey) throw new Error('BOOKING_CHECKIN_API_KEY_REQUIRED');
    const version = (process.env.BOOKING_CHECKIN_ENDPOINT_VERSION ??
      'v3') as BookingCheckinEndpointVersion;
    if (!['v1', 'v3'].includes(version))
      throw new Error('BOOKING_CHECKIN_ENDPOINT_VERSION_INVALID');
    const base = new URL(
      process.env.BOOKING_CHECKIN_BASE_URL ??
        `https://booking-core-api.azurewebsites.net/api/${version}`,
    );
    if (base.protocol !== 'https:' || base.username || base.password)
      throw new Error('BOOKING_CHECKIN_BASE_URL_INVALID');
    const action = (process.env.BOOKING_CHECKIN_V1_ACTION ??
      'checkin-entrega') as BookingCheckinV1Action;
    if (!['checkin', 'checkin-entrega'].includes(action))
      throw new Error('BOOKING_CHECKIN_V1_ACTION_INVALID');
    const encodedCode = encodeURIComponent(payload.booking_code);
    const path =
      version === 'v1'
        ? `autos/orders/${encodedCode}/${action}`
        : `reservas/${encodedCode}/checkin`;
    const requestBody =
      version === 'v1'
        ? action === 'checkin-entrega'
          ? {
              licencia_conducir: payload.licencia_conducir,
              km_salida: payload.km_salida,
            }
          : { documento_identidad: payload.documento_identidad }
        : {
            staff_user: payload.staff_user,
            fecha_checkin: payload.fecha_checkin,
          };
    const response = await fetch(
      new URL(path, `${base.toString().replace(/\/$/, '')}/`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': apiKey,
          'X-Correlation-Id': correlationId,
          'Idempotency-Key': `mdu-checkin-${payload.booking_code}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8000),
      },
    );
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const code =
        body && typeof body === 'object' && 'code' in body
          ? String((body as Record<string, unknown>).code).slice(0, 80)
          : null;
      throw new Error(
        `BOOKING_CHECKIN_HTTP_${response.status}${code ? `:${code}` : ''}`,
      );
    }
    if (!this.isAck(body)) throw new Error('BOOKING_CHECKIN_INVALID_ACK');
    return body;
  }

  private isAck(value: unknown): value is BookingCheckinAck {
    if (!value || typeof value !== 'object') return false;
    const ack = value as Record<string, unknown>;
    return ack.acknowledged === true && ack.status === 'CONFIRMADO_ASISTIDO';
  }
}
