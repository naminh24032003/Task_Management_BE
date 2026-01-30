/**
 * Event Publisher Port
 * Abstraction for publishing integration events to message brokers
 */

export interface EventMessage {
  key?: string;
  value: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface PublishOptions {
  topic: string;
  messages: EventMessage[];
}

/**
 * Interface for publishing user-related events
 * Implementations can use Kafka, RabbitMQ, or any other message broker
 */
export interface IEventPublisher {
  /**
   * Publish messages to a specific topic
   */
  publish(options: PublishOptions): Promise<void>;

  /**
   * Publish a user-related event with standard metadata
   */
  publishUserEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Publish failed messages to dead letter queue
   */
  publishToDeadLetterQueue(
    originalTopic: string,
    message: EventMessage,
    error: Error,
  ): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('IEventPublisher');
