/**
 * Domain event emitted when a user is suspended
 */
export class UserSuspendedEvent {
  public readonly eventName = 'UserSuspended';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly previousStatus: string,
    public readonly reason?: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
