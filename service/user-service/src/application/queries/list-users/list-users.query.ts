import { UserStatus } from '../../../domain/aggregates/user.aggregate';

export class ListUsersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status?: UserStatus,
    public readonly search?: string,
  ) {}
}
