export class AssignRolesCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly roleIds: string[],
  ) {}
}
