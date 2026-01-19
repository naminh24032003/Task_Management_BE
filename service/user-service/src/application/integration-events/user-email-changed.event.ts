import { IEvent } from '@nestjs/cqrs';

export class UserEmailChangedEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly oldEmail: string,
    public readonly newEmail: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
