import { IEvent } from '@nestjs/cqrs';

export class UserRegisteredEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
