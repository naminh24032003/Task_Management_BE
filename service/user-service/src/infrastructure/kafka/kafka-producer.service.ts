import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, CompressionTypes, logLevel, SASLOptions } from 'kafkajs';
import { KafkaConfig } from '../config/kafka.config';
import {
  IEventPublisher,
  EventMessage,
  PublishOptions,
} from '../../application/ports/event-publisher.port';

// Re-export types for backward compatibility
export { EventMessage as KafkaMessage, PublishOptions };

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy, IEventPublisher {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;
  private readonly config: KafkaConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<KafkaConfig>('kafka')!;
    this.initializeKafka();
  }

  private initializeKafka(): void {
    const saslConfig: SASLOptions = {
      mechanism: this.config.sasl.mechanism,
      username: this.config.sasl.username,
      password: this.config.sasl.password,
    } as SASLOptions;

    this.kafka = new Kafka({
      clientId: `${this.config.clientId}-producer`,
      brokers: this.config.brokers,
      sasl: saslConfig,
      ssl: this.config.ssl,
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
      retry: {
        initialRetryTime: this.config.retry.initialRetryTime,
        retries: this.config.retry.retries,
      },
      logLevel: logLevel.WARN,
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionalId: `${this.config.clientId}-transactional`,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Kafka on module init', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.log('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka producer', error);
    }
  }

  async publish(options: PublishOptions): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const messages = options.messages.map((msg) => ({
      key: msg.key,
      value: JSON.stringify(msg.value),
      headers: msg.headers,
    }));

    try {
      const result = await this.producer.send({
        topic: options.topic,
        compression: CompressionTypes.GZIP,
        messages,
      });

      this.logger.debug(
        `Published ${messages.length} message(s) to topic ${options.topic}`,
        result,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish to topic ${options.topic}`,
        error,
      );
      throw error;
    }
  }

  async publishUserEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      service: 'user-service',
      version: '1.0',
      ...payload,
    };

    await this.publish({
      topic: this.config.topics.userEvents,
      messages: [
        {
          key: payload.userId as string,
          value: event,
          headers: {
            event_type: eventType,
            service: 'user-service',
            version: '1.0',
          },
        },
      ],
    });

    this.logger.log(`Published user event: ${eventType}`, { userId: payload.userId });
  }

  async publishToDeadLetterQueue(
    originalTopic: string,
    message: EventMessage,
    error: Error,
  ): Promise<void> {
    await this.publish({
      topic: this.config.topics.deadLetterQueue,
      messages: [
        {
          key: message.key,
          value: {
            original_topic: originalTopic,
            original_message: message.value,
            error_message: error.message,
            error_stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        },
      ],
    });
  }

  getTopics(): KafkaConfig['topics'] {
    return this.config.topics;
  }
}
