/**
 * Domain event emitted when a user is deleted (soft delete)
 */
export class UserDeletedEvent {
  public readonly eventName = 'UserDeleted';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
