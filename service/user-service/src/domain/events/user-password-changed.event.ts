/**
 * Domain event emitted when user password is changed
 */
export class UserPasswordChangedEvent {
  public readonly eventName = 'UserPasswordChanged';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
