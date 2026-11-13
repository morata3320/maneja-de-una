import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { BookingCheckinClient } from './booking-checkin.client';
import { BookingClientsService } from './booking-clients.service';

type OrderRow = Record<string, unknown> & {
  id: string;
  locator: string;
  client_id?: string | null;
  driver_details: Record<string, unknown>;
  delivered_at?: Date | string | null;
};

type NotificationRow = {
  order_id: string;
  client_id: string;
  external_order_id: string;
  admin_id: string;
  checkin_at: Date | string;
  observations: string;
  status: 'PENDING' | 'SENDING' | 'ACKNOWLEDGED';
  attempts: number;
  response_payload: Record<string, unknown> | null;
  acknowledged_at?: Date | string | null;
};

function mutationRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
}

@Injectable()
export class BookingCheckinService {
  constructor(
    private readonly db: DataSource,
    private readonly clients: BookingClientsService,
    private readonly client: BookingCheckinClient,
  ) {}

  async prepare(
    manager: EntityManager,
    order: OrderRow,
    adminId: string,
    observations: string,
  ): Promise<string> {
    let clientId = typeof order.client_id === 'string' ? order.client_id : null;
    if (!clientId) {
      const client = await this.clients.findForDriver(
        manager,
        order.driver_details ?? {},
      );
      if (!client)
        throw new UnprocessableEntityException(
          'El conductor debe registrarse en /api/v3/clientes antes de la entrega.',
        );
      clientId = client.id;
      await manager.query(
        'UPDATE orders SET client_id=$2,updated_at=now() WHERE id=$1',
        [order.id, clientId],
      );
    }
    const checkinAt = order.delivered_at
      ? new Date(order.delivered_at)
      : new Date();
    await manager.query(
      `INSERT INTO booking_checkin_notifications(
         order_id,client_id,external_order_id,admin_id,checkin_at,observations
       ) VALUES($1,$2,$6,$3,$4,$5)
       ON CONFLICT(order_id) DO NOTHING`,
      [order.id, clientId, adminId, checkinAt, observations, order.locator],
    );
    return clientId;
  }

  async notify(orderId: string, correlationId: string) {
    const claim = await this.db.transaction(async (manager) => {
      const result = await manager.query(
        `UPDATE booking_checkin_notifications n
         SET status='SENDING',attempts=n.attempts+1,
             external_order_id=o.locator,
             next_attempt_at=now()+interval '60 seconds',updated_at=now()
         FROM orders o
         WHERE n.order_id=$1 AND o.id=n.order_id
           AND (n.status='PENDING' OR (n.status='SENDING' AND n.next_attempt_at<=now()))
         RETURNING n.*`,
        [orderId],
      );
      const [row] = mutationRows<NotificationRow>(result);
      if (row) return { row, acquired: true };
      const [current] = await manager.query<NotificationRow[]>(
        'SELECT * FROM booking_checkin_notifications WHERE order_id=$1',
        [orderId],
      );
      if (!current)
        throw new ConflictException('Notificacion de check-in no preparada.');
      return { row: current, acquired: false };
    });
    const claimed = claim.row;

    if (claimed.status === 'ACKNOWLEDGED')
      return {
        ...claimed.response_payload,
        acknowledged: true,
        status: 'CONFIRMADO_ASISTIDO' as const,
        attempts: claimed.attempts,
      };
    if (!claim.acquired || claimed.status !== 'SENDING')
      return {
        acknowledged: false,
        status: claimed.status,
        attempts: claimed.attempts,
      };

    try {
      const ack = await this.client.notify(
        {
          booking_code: claimed.external_order_id,
          staff_user: claimed.admin_id,
          fecha_checkin: new Date(claimed.checkin_at).toISOString(),
        },
        correlationId,
      );
      await this.db.query(
        `UPDATE booking_checkin_notifications
         SET status='ACKNOWLEDGED',response_payload=$2,acknowledged_at=now(),
             last_error=NULL,updated_at=now() WHERE order_id=$1`,
        [orderId, ack],
      );
      return { ...ack, attempts: claimed.attempts };
    } catch (error) {
      const delay = Math.min(300, 2 ** Math.min(claimed.attempts, 8));
      const message =
        error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN_ERROR';
      await this.db.query(
        `UPDATE booking_checkin_notifications
         SET status='PENDING',last_error=$2,
             next_attempt_at=now()+($3 * interval '1 second'),updated_at=now()
         WHERE order_id=$1`,
        [orderId, message, delay],
      );
      return {
        acknowledged: false,
        status: 'PENDING' as const,
        attempts: claimed.attempts,
        error: message,
      };
    }
  }
}
