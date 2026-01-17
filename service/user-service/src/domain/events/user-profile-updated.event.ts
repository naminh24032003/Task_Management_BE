/**
 * Domain event emitted when a user's profile is updated
 */
export class UserProfileUpdatedEvent {
  public readonly eventName = 'UserProfileUpdated';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly updatedFields: string[],
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
