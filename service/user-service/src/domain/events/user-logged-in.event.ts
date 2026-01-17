/**
 * Domain event emitted when a user logs in
 */
export class UserLoggedInEvent {
  public readonly eventName = 'UserLoggedIn';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
