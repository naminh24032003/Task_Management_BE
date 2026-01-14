/**
 * Domain event emitted when a new user is created
 */
export class UserCreatedEvent {
  public readonly eventName = 'UserCreated';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
