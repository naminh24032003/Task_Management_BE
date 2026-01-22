import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { UserRegisteredEvent } from '../integration-events/user-registered.event';
import { KafkaProducerService } from '../../infrastructure/kafka/kafka-producer.service';

@EventsHandler(UserRegisteredEvent)
export class UserRegisteredHandler implements IEventHandler<UserRegisteredEvent> {
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(`Handling UserRegisteredEvent for user: ${event.userId}`);

    try {
      await this.kafkaProducer.publishUserEvent('user.registered', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        firstName: event.firstName,
        lastName: event.lastName,
        timestamp: event.timestamp.toISOString(),
      });

      this.logger.log(`Successfully published user.registered event for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish user.registered event for user: ${event.userId}`,
        error,
      );
    }
  }
}
