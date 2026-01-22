import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { UserEmailChangedEvent } from '../integration-events/user-email-changed.event';
import { KafkaProducerService } from '../../infrastructure/kafka/kafka-producer.service';

@EventsHandler(UserEmailChangedEvent)
export class UserEmailChangedHandler implements IEventHandler<UserEmailChangedEvent> {
  private readonly logger = new Logger(UserEmailChangedHandler.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  async handle(event: UserEmailChangedEvent): Promise<void> {
    this.logger.log(`Handling UserEmailChangedEvent for user: ${event.userId}`);

    try {
      await this.kafkaProducer.publishUserEvent('user.email_changed', {
        userId: event.userId,
        tenantId: event.tenantId,
        oldEmail: event.oldEmail,
        newEmail: event.newEmail,
        timestamp: event.timestamp.toISOString(),
      });

      this.logger.log(`Successfully published user.email_changed event for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish user.email_changed event for user: ${event.userId}`,
        error,
      );
    }
  }
}
