import { Injectable } from '@nestjs/common';
import type {
  StockUpdateAck,
  StockUpdateMessage,
} from './inventory-stock.types';

@Injectable()
export class InventoryRestClient {
  isEnabled(): boolean {
    return (
      process.env.STOCK_SYNC_ENABLED === 'true' &&
      process.env.STOCK_SYNC_TRANSPORT === 'rest' &&
      Boolean(process.env.BOOKING_STOCK_URL) &&
      Boolean(process.env.BOOKING_STOCK_API_KEY)
    );
  }

  async push(message: StockUpdateMessage): Promise<StockUpdateAck> {
    if (!this.isEnabled()) throw new Error('STOCK_SYNC_DISABLED');
    const url = process.env.BOOKING_STOCK_URL;
    if (!url) throw new Error('BOOKING_STOCK_URL is required');
    const apiKey = process.env.BOOKING_STOCK_API_KEY;
    if (!apiKey) throw new Error('BOOKING_STOCK_API_KEY is required');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': apiKey,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok)
      throw new Error(
        `BOOKING_REST_${response.status}: ${response.statusText}`,
      );
    if (!isStockUpdateAck(payload)) throw new Error('INVALID_BOOKING_REST_ACK');
    return payload;
  }
}

function isStockUpdateAck(value: unknown): value is StockUpdateAck {
  if (!value || typeof value !== 'object') return false;
  const ack = value as Record<string, unknown>;
  return (
    typeof ack.success === 'boolean' &&
    typeof ack.message === 'string' &&
    typeof ack.processed_at === 'number' &&
    typeof ack.error_code === 'string' &&
    typeof ack.current_available === 'number'
  );
}
