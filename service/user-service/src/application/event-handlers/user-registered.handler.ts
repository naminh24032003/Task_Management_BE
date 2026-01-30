import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UserRegisteredEvent } from '../integration-events/user-registered.event';
import { IEventPublisher, EVENT_PUBLISHER } from '../ports/event-publisher.port';

@EventsHandler(UserRegisteredEvent)
export class UserRegisteredHandler implements IEventHandler<UserRegisteredEvent> {
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(`Handling UserRegisteredEvent for user: ${event.userId}`);

    try {
      await this.eventPublisher.publishUserEvent('user.registered', {
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
