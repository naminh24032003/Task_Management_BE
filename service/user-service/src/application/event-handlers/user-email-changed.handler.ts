import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UserEmailChangedEvent } from '../integration-events/user-email-changed.event';
import { IEventPublisher, EVENT_PUBLISHER } from '../ports/event-publisher.port';

@EventsHandler(UserEmailChangedEvent)
export class UserEmailChangedHandler implements IEventHandler<UserEmailChangedEvent> {
  private readonly logger = new Logger(UserEmailChangedHandler.name);

  constructor(
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async handle(event: UserEmailChangedEvent): Promise<void> {
    this.logger.log(`Handling UserEmailChangedEvent for user: ${event.userId}`);

    try {
      await this.eventPublisher.publishUserEvent('user.email_changed', {
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
