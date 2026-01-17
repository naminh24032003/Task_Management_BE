/**
 * Domain event emitted when a role is added to a user
 */
export class UserRoleAddedEvent {
  public readonly eventName = 'UserRoleAdded';
  public readonly occurredAt: Date;

  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly roleId: string,
  ) {
    this.occurredAt = new Date();
    Object.freeze(this);
  }
}
