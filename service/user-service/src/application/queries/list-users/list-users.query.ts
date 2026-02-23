import { UserStatus } from '../../../domain/aggregates/user.aggregate';

export class ListUsersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status?: UserStatus,
    public readonly search?: string,
    public readonly cursor?: string,
    public readonly limit?: number,
  ) {}

  isCursorBased(): boolean {
    return !!this.cursor || (!!this.limit && !this.page);
  }
}
