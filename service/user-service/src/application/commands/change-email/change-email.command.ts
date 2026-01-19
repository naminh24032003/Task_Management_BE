export class ChangeEmailCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly newEmail: string,
  ) {}
}
