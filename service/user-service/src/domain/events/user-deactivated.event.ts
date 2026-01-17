/**
 * Domain event emitted when a user is deactivated
 */
export class UserDeactivatedEvent {
  public readonly eventName = 'UserDeactivated';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly previousStatus: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
