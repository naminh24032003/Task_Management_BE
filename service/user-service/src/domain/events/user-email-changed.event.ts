/**
 * Domain event emitted when user email is changed
 */
export class UserEmailChangedEvent {
  public readonly eventName = 'UserEmailChanged';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly oldEmail: string,
    public readonly newEmail: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
