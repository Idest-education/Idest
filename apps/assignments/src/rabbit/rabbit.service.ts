import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

/**
 * Marker error for failures that are worth retrying (network blips, upstream
 * 5xx, DB timeouts). Anything that is NOT a `TransientError` is treated as a
 * poison message and dead-lettered immediately by `RabbitService.consume`.
 */
export class TransientError extends Error {}

@Injectable()
export class RabbitService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;
  private readonly logger = new Logger(RabbitService.name);

  // Retry policy — read once so tests can drive it via a stub ConfigService.
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(private configService: ConfigService) {
    this.maxAttempts = Number(
      this.configService.get('RABBIT_MAX_ATTEMPTS') ?? 3,
    );
    this.retryDelayMs = Number(
      this.configService.get('RABBIT_RETRY_DELAY_MS') ?? 5000,
    );
  }

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

      // NOTE: the main queue is asserted with ONLY `{ durable: true }`. The live
      // `grade_queue` was created without dead-letter args, so re-asserting it
      // with `deadLetterExchange`/`deadLetterRoutingKey` would throw
      // PRECONDITION_FAILED on a real broker. Dead-lettering is therefore done
      // by explicitly publishing poison messages to a separate `<queue>.dead`
      // queue and acking the original (see the catch block below).
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
              await this.handleConsumeFailure(queue, msg, error as Error);
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

  /**
   * Failure policy for a consumed message:
   *  - `TransientError` and attempts still below the cap → bump the
   *    `x-attempts` header, ack the original, and re-publish to the main queue
   *    after `retryDelayMs`.
   *  - non-transient error, OR the retry cap is reached → publish the raw
   *    payload to `<queue>.dead` (asserted on demand) with an `x-death-reason`
   *    header, then ack the original so it stops looping on the main queue.
   */
  private async handleConsumeFailure(
    queue: string,
    msg: amqp.ConsumeMessage,
    error: Error,
  ): Promise<void> {
    if (!this.channel) {
      return;
    }

    const headers = msg.properties.headers ?? {};
    const attempts = Number(headers['x-attempts'] ?? 0);
    const transient = error instanceof TransientError;

    this.logger.error(
      `Message from "${queue}" failed (attempt ${attempts}, transient=${transient}): ${error?.message}`,
      error,
    );

    if (transient && attempts + 1 < this.maxAttempts) {
      const retryHeaders = { ...headers, 'x-attempts': attempts + 1 };
      this.channel.ack(msg);
      setTimeout(() => {
        this.channel?.sendToQueue(queue, msg.content, {
          persistent: true,
          headers: retryHeaders,
        });
      }, this.retryDelayMs);
      this.logger.warn(
        `Scheduled retry ${attempts + 1}/${this.maxAttempts} for "${queue}" in ${this.retryDelayMs}ms`,
      );
      return;
    }

    const deadQueue = `${queue}.dead`;
    const reason = transient
      ? `retry cap (${this.maxAttempts}) exhausted: ${error?.message ?? 'transient error'}`
      : `non-transient error: ${error?.message ?? 'unknown error'}`;

    await this.channel.assertQueue(deadQueue, { durable: true });
    this.channel.sendToQueue(deadQueue, msg.content, {
      persistent: true,
      headers: { ...headers, 'x-death-reason': reason },
    });
    this.channel.ack(msg);
    this.logger.warn(`Dead-lettered message from "${queue}" -> "${deadQueue}": ${reason}`);
  }
}
