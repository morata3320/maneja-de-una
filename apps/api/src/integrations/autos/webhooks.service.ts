import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type {
  WebhookSubscription,
  WebhookPayload,
} from './contract/autos.types';
import type { SubscriptionRow } from '../../persistence/rows';
import { AutosError } from './autos-error';
export function encryptionKey(): Buffer {
  const key = process.env.WEBHOOK_ENCRYPTION_KEY ?? '';
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error('WEBHOOK_ENCRYPTION_KEY requiere 32 bytes hex.');
  return Buffer.from(key, 'hex');
}
function encrypt(value: string): string {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function decrypt(value: string): string {
  const buffer = Buffer.from(value, 'base64'),
    cipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      buffer.subarray(0, 12),
    );
  cipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([
    cipher.update(buffer.subarray(28)),
    cipher.final(),
  ]).toString('utf8');
}
function publicAddress(address: string): boolean {
  if (isIP(address) === 6)
    return (
      /^[23][0-9a-f]{3}:/i.test(address) &&
      !address.toLowerCase().startsWith('2001:db8:')
    );
  const [a, b, c] = address.split('.').map(Number);
  return (
    isIP(address) === 4 &&
    a !== 0 &&
    a !== 10 &&
    a !== 127 &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && b === 168) &&
    !(a === 192 && b === 0 && (c === 0 || c === 2)) &&
    !(a === 192 && b === 88 && c === 99) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19)) &&
    !(a === 198 && b === 51 && c === 100) &&
    !(a === 203 && b === 0 && c === 113)
  );
}
export async function deliver(
  urlText: string,
  payload: WebhookPayload,
  secret?: string,
): Promise<number> {
  const url = new URL(urlText);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('DESTINATION_UNSUPPORTED');
  const records = await lookup(url.hostname.replace(/^\[|\]$/g, ''), {
    all: true,
  });
  const allowLoopback =
    process.env.NODE_ENV !== 'production' &&
    process.env.WEBHOOK_ALLOW_LOOPBACK === 'true';
  if (
    !records.length ||
    records.some(
      (r) =>
        !publicAddress(r.address) &&
        !(allowLoopback && (r.address === '127.0.0.1' || r.address === '::1')),
    )
  )
    throw new Error('DESTINATION_BLOCKED');
  const body = JSON.stringify(payload);
  return new Promise<number>((resolve, reject) => {
    const selected = records[0];
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        protocol: url.protocol,
        hostname: selected.address,
        port: url.port || undefined,
        servername: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Host: url.host,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(secret
            ? {
                'X-Webhook-Signature': createHmac('sha256', secret)
                  .update(body)
                  .digest('hex'),
              }
            : {}),
        },
      },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 0;
        response.on('end', () => resolve(status));
      },
    );
    request.setTimeout(3000, () => request.destroy(new Error('TIMEOUT')));
    request.on('error', () => reject(new Error('DELIVERY_FAILED')));
    request.end(body);
  });
}
@Injectable()
export class WebhooksService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private current?: Promise<void>;
  constructor(private readonly db: DataSource) {}
  onModuleInit() {
    encryptionKey();
    if (process.env.WEBHOOK_WORKER_ENABLED !== 'false') {
      this.timer = setInterval(() => {
        if (!this.running) {
          this.current = this.tick().catch(() => undefined);
        }
      }, 1000);
      this.timer.unref();
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.current;
  }
  async list(owner: string): Promise<WebhookSubscription[]> {
    const rows = await this.db.query<SubscriptionRow[]>(
      'SELECT * FROM webhook_subscriptions WHERE owner_id=$1 AND active ORDER BY id',
      [owner],
    );
    return rows.map((r) => ({ id: r.id, url: r.url, events: r.events }));
  }
  async create(
    body: WebhookSubscription,
    owner: string,
  ): Promise<WebhookSubscription> {
    const rows = await this.db.query<Array<{ id: string }>>(
      'INSERT INTO webhook_subscriptions(id,owner_id,url,events,encrypted_secret) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',
      [
        body.id,
        owner,
        body.url,
        JSON.stringify(body.events),
        body.secret === undefined ? null : encrypt(body.secret),
      ],
    );
    if (!rows.length)
      throw new AutosError(
        409,
        'VALIDATION_FAILED',
        'ID de suscripción ya existente.',
      );
    return { id: body.id, url: body.url, events: body.events };
  }
  async remove(id: string, owner: string): Promise<void> {
    await this.db.query(
      'UPDATE webhook_subscriptions SET active=false,updated_at=now() WHERE id=$1 AND owner_id=$2',
      [id, owner],
    );
  }
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.db.transaction(async (m) => {
        const events = await m.query<
          Array<{
            id: string;
            owner_id: string | null;
            event_type: string;
            created_at: Date;
          }>
        >(
          'SELECT * FROM webhook_outbox WHERE NOT dispatched ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20',
        );
        for (const event of events) {
          const subs = await m.query<Array<{ id: string }>>(
            'SELECT id FROM webhook_subscriptions WHERE active AND ($1::text IS NULL OR owner_id=$1) AND events ? $2 AND created_at<=$3',
            [event.owner_id, event.event_type, event.created_at],
          );
          for (const sub of subs)
            await m.query(
              'INSERT INTO webhook_delivery_attempts(id,event_id,subscription_id) VALUES($1,$2,$3) ON CONFLICT(event_id,subscription_id) DO NOTHING',
              [randomUUID(), event.id, sub.id],
            );
          await m.query(
            'UPDATE webhook_outbox SET dispatched=true,updated_at=now() WHERE id=$1',
            [event.id],
          );
        }
      });
      await this.db.transaction(async (m) => {
        const [job] = await m.query<
          Array<{
            id: string;
            event_id: string;
            attempt_count: number;
            url: string;
            encrypted_secret: string | null;
            active: boolean;
            event_type: string;
            resource_id: string;
            data: Record<string, unknown>;
            created_at: Date;
          }>
        >(
          `SELECT a.id,a.event_id,a.attempt_count,s.url,s.encrypted_secret,s.active,e.event_type,e.resource_id,e.data,e.created_at FROM webhook_delivery_attempts a JOIN webhook_subscriptions s ON s.id=a.subscription_id JOIN webhook_outbox e ON e.id=a.event_id WHERE a.status='PENDING' AND a.next_attempt_at<=now() ORDER BY a.created_at FOR UPDATE OF a SKIP LOCKED LIMIT 1`,
        );
        if (!job) return;
        if (!job.active) {
          await m.query(
            "UPDATE webhook_delivery_attempts SET status='CANCELLED',updated_at=now() WHERE id=$1",
            [job.id],
          );
          return;
        }
        let status = 0,
          error: string | null = null;
        try {
          status = await deliver(
            job.url,
            {
              eventId: job.event_id,
              eventType: job.event_type,
              timestamp: job.created_at.toISOString(),
              resourceId: job.resource_id,
              data: job.data,
            },
            job.encrypted_secret ? decrypt(job.encrypted_secret) : undefined,
          );
        } catch {
          error = 'DELIVERY_FAILED';
        }
        const count = job.attempt_count + 1,
          success = status >= 200 && status < 300;
        await m.query(
          'UPDATE webhook_delivery_attempts SET attempt_count=$2,status=$3,last_error=$4,last_status=$5,next_attempt_at=$6,updated_at=now() WHERE id=$1',
          [
            job.id,
            count,
            success ? 'DELIVERED' : count >= 5 ? 'FAILED' : 'PENDING',
            success ? null : (error ?? 'HTTP_FAILURE'),
            status || null,
            new Date(Date.now() + Math.min(3600000, 1000 * 2 ** count)),
          ],
        );
      });
    } finally {
      this.running = false;
    }
  }
}
