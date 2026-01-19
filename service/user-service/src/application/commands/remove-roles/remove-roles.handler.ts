import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RemoveRolesCommand } from './remove-roles.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User } from '../../../domain/aggregates/user.aggregate';

export interface RemoveRolesResult {
  user: User;
}

@CommandHandler(RemoveRolesCommand)
export class RemoveRolesHandler implements ICommandHandler<RemoveRolesCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: RemoveRolesCommand): Promise<RemoveRolesResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    for (const roleId of command.roleIds) {
      user.removeRole(roleId);
    }

    const savedUser = await this.userRepository.save(user);
    return { user: savedUser };
  }
}
