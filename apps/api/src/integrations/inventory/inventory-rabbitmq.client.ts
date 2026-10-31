import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import type {
  StockUpdateAck,
  StockUpdateMessage,
} from './inventory-stock.types';

const EXCHANGE = 'booking.events';
const ROUTING_KEY = 'stock.updated';

@Injectable()
export class InventoryRabbitMqClient implements OnApplicationShutdown {
  private readonly logger = new Logger(InventoryRabbitMqClient.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connecting?: Promise<ConfirmChannel>;

  isEnabled(): boolean {
    return (
      process.env.STOCK_SYNC_ENABLED === 'true' &&
      process.env.STOCK_SYNC_TRANSPORT === 'rabbitmq' &&
      Boolean(process.env.RABBITMQ_URL)
    );
  }

  async push(message: StockUpdateMessage): Promise<StockUpdateAck> {
    if (!this.isEnabled()) throw new Error('RABBITMQ_STOCK_SYNC_DISABLED');
    const channel = await this.getChannel();
    const payload = Buffer.from(
      JSON.stringify({
        service_id: message.service_id,
        item_id: message.item_id,
        available_units: message.available_units,
        date: message.date,
      }),
    );

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        EXCHANGE,
        ROUTING_KEY,
        payload,
        {
          contentType: 'application/json',
          deliveryMode: 2,
          persistent: true,
          messageId: `${message.service_id}:${message.item_id}:${message.timestamp}`,
          timestamp: Math.floor(message.timestamp / 1000),
          type: ROUTING_KEY,
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });

    return {
      success: true,
      message: 'RabbitMQ publisher confirm received',
      processed_at: Date.now(),
      error_code: 'OK',
      current_available: message.available_units,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private getChannel(): Promise<ConfirmChannel> {
    if (this.channel) return Promise.resolve(this.channel);
    if (this.connecting) return this.connecting;
    this.connecting = this.connectAndAssertExchange().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async connectAndAssertExchange(): Promise<ConfirmChannel> {
    const rawUrl = process.env.RABBITMQ_URL;
    if (!rawUrl) throw new Error('RABBITMQ_URL is required');
    const url = new URL(rawUrl);
    if (url.protocol !== 'amqps:')
      throw new Error('RABBITMQ_URL must use AMQPS');

    const connection = await connect(rawUrl, { servername: url.hostname });
    connection.on('error', (error) => {
      this.logger.error(`RabbitMQ connection error: ${String(error)}`);
    });
    connection.on('close', () => {
      this.connection = undefined;
      this.channel = undefined;
    });
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    channel.on('close', () => {
      this.channel = undefined;
    });
    this.connection = connection;
    this.channel = channel;
    this.logger.log(
      `RabbitMQ AMQPS ready: exchange=${EXCHANGE}, routing=${ROUTING_KEY}`,
    );
    return channel;
  }
}
