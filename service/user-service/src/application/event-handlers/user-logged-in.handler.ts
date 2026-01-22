import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { KafkaProducerService } from '../../infrastructure/kafka/kafka-producer.service';

export class UserLoggedInIntegrationEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

@EventsHandler(UserLoggedInIntegrationEvent)
export class UserLoggedInHandler implements IEventHandler<UserLoggedInIntegrationEvent> {
  private readonly logger = new Logger(UserLoggedInHandler.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  async handle(event: UserLoggedInIntegrationEvent): Promise<void> {
    this.logger.log(`Handling UserLoggedInEvent for user: ${event.userId}`);

    try {
      await this.kafkaProducer.publishUserEvent('user.logged_in', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: event.timestamp.toISOString(),
      });

      this.logger.log(`Successfully published user.logged_in event for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish user.logged_in event for user: ${event.userId}`,
        error,
      );
    }
  }
}
