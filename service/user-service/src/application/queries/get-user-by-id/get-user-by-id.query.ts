export class GetUserByIdQuery {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {}
}
