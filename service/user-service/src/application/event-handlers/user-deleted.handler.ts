import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UserDeletedEvent } from '../integration-events/user-deleted.event';
import { IEventPublisher, EVENT_PUBLISHER } from '../ports/event-publisher.port';

@EventsHandler(UserDeletedEvent)
export class UserDeletedHandler implements IEventHandler<UserDeletedEvent> {
  private readonly logger = new Logger(UserDeletedHandler.name);

  constructor(
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async handle(event: UserDeletedEvent): Promise<void> {
    this.logger.log(`Handling UserDeletedEvent for user: ${event.userId}`);

    try {
      await this.eventPublisher.publishUserEvent('user.deleted', {
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
