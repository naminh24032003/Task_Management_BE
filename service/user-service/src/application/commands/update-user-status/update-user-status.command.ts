import { UserStatus } from '../../../domain/aggregates/user.aggregate';

export class UpdateUserStatusCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly status: UserStatus,
  ) {}
}
