export class GoogleLoginCommand {
  constructor(
    public readonly tenantId: string,
    public readonly idToken: string,
  ) {}
}
