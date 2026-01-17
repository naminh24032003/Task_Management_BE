/**
 * Domain event emitted when a user is activated
 */
export class UserActivatedEvent {
  public readonly eventName = 'UserActivated';
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
