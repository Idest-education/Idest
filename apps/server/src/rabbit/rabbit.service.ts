import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitService implements OnModuleInit {
  private channel: any;

  async onModuleInit() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    this.channel = await connection.createChannel();
  }

  async send(queue: string, data: any) {
    await this.channel.assertQueue(queue);
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  }

  async consume(queue: string, callback: (data: any) => void | Promise<void>) {
    await this.channel.assertQueue(queue);
    this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data);
        this.channel.ack(msg);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`rabbit consume error on "${queue}":`, err);
        this.channel.nack(msg, false, false);
      }
    });
  }
}
