import 'dotenv/config';
import { connect } from 'amqplib';

const exchange = 'booking.events';
const rawUrl = process.env.RABBITMQ_URL;
if (!rawUrl) throw new Error('RABBITMQ_URL no está configurada.');
const url = new URL(rawUrl);
if (url.protocol !== 'amqps:')
  throw new Error('RABBITMQ_URL debe usar AMQPS/TLS.');

const connection = await connect(rawUrl, { servername: url.hostname });
try {
  const channel = await connection.createConfirmChannel();
  try {
    await channel.assertExchange(exchange, 'topic', { durable: true });
    console.log(
      JSON.stringify({
        amqps: 'PASS',
        tls: true,
        exchange,
        type: 'topic',
        durable: true,
        published: false,
      }),
    );
  } finally {
    await channel.close();
  }
} finally {
  await connection.close();
}
