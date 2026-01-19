import { UserStatus } from '../../../domain/aggregates/user.aggregate';

export class UpdateUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly displayName?: string,
    public readonly status?: UserStatus,
  ) {}
}
