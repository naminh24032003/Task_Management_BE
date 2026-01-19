export class LoginCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}
