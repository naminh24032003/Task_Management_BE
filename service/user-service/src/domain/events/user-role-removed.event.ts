/**
 * Domain event emitted when a role is removed from a user
 */
export class UserRoleRemovedEvent {
  public readonly eventName = 'UserRoleRemoved';
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
