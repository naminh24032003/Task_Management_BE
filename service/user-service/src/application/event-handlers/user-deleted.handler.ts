import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { UserDeletedEvent } from '../integration-events/user-deleted.event';
import { KafkaProducerService } from '../../infrastructure/kafka/kafka-producer.service';

@EventsHandler(UserDeletedEvent)
export class UserDeletedHandler implements IEventHandler<UserDeletedEvent> {
  private readonly logger = new Logger(UserDeletedHandler.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  async handle(event: UserDeletedEvent): Promise<void> {
    this.logger.log(`Handling UserDeletedEvent for user: ${event.userId}`);

    try {
      await this.kafkaProducer.publishUserEvent('user.deleted', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        timestamp: event.timestamp.toISOString(),
      });

      this.logger.log(`Successfully published user.deleted event for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish user.deleted event for user: ${event.userId}`,
        error,
      );
    }
  }
}
