import { Injectable } from '@nestjs/common';

export type BookingCheckinPayload = {
  external_order_id: string;
  client_id: string;
  estado: 'CONFIRMADO_ASISTIDO';
  admin_id: string;
  fecha_checkin: string;
  observaciones: string;
};

export type BookingCheckinAck = {
  acknowledged: true;
  status: 'CONFIRMADO_ASISTIDO';
};

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
    const base = new URL(
      process.env.BOOKING_CHECKIN_BASE_URL ??
        'https://booking-core-api.azurewebsites.net/api/v3',
    );
    if (base.protocol !== 'https:' || base.username || base.password)
      throw new Error('BOOKING_CHECKIN_BASE_URL_INVALID');
    const path = `reservas/${encodeURIComponent(payload.external_order_id)}/checkin`;
    const response = await fetch(
      new URL(path, `${base.toString().replace(/\/$/, '')}/`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': apiKey,
          'X-Correlation-Id': correlationId,
          'Idempotency-Key': `mdu-checkin-${payload.external_order_id}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      },
    );
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok)
      throw new Error(`BOOKING_CHECKIN_HTTP_${response.status}`);
    if (!this.isAck(body)) throw new Error('BOOKING_CHECKIN_INVALID_ACK');
    return body;
  }

  private isAck(value: unknown): value is BookingCheckinAck {
    if (!value || typeof value !== 'object') return false;
    const ack = value as Record<string, unknown>;
    return ack.acknowledged === true && ack.status === 'CONFIRMADO_ASISTIDO';
  }
}
