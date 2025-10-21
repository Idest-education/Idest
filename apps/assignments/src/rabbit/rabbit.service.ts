import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;
  private readonly logger = new Logger(RabbitService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672';
      
      this.logger.log(`Connecting to RabbitMQ at ${rabbitmqUrl}`);
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      this.logger.log('Successfully connected to RabbitMQ');

      this.connection.on('error', (err: Error) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  private async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('Disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error('Error disconnecting from RabbitMQ', error);
    }
  }

  async send(queue: string, message: any): Promise<boolean> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      await this.channel.assertQueue(queue, {
        durable: true,
      });

      const sent = this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
        }
      );

      if (sent) {
        this.logger.log(`Message sent to queue "${queue}"`);
      } else {
        this.logger.warn(`Failed to send message to queue "${queue}"`);
      }

      return sent;
    } catch (error) {
      this.logger.error(`Error sending message to queue "${queue}"`, error);
      throw error;
    }
  }

  async consume(
    queue: string,
    callback: (msg: any) => Promise<void>,
  ): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      await this.channel.assertQueue(queue, {
        durable: true,
      });

      await this.channel.prefetch(1);

      this.logger.log(`Started consuming from queue "${queue}"`);

      await this.channel.consume(
        queue,
        async (msg: amqp.ConsumeMessage | null) => {
          if (msg && this.channel) {
            try {
              const content = JSON.parse(msg.content.toString());
              await callback(content);
              
              this.channel.ack(msg);
              this.logger.log(`Message processed from queue "${queue}"`);
            } catch (error) {
              this.logger.error(`Error processing message from queue "${queue}"`, error);
              
              if (this.channel) {
                this.channel.nack(msg, false, true);
              }
            }
          }
        },
        {
          noAck: false,
        }
      );
    } catch (error) {
      this.logger.error(`Error consuming from queue "${queue}"`, error);
      throw error;
    }
  }
}
