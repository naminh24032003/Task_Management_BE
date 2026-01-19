import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignRolesCommand } from './assign-roles.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User } from '../../../domain/aggregates/user.aggregate';

export interface AssignRolesResult {
  user: User;
}

@CommandHandler(AssignRolesCommand)
export class AssignRolesHandler implements ICommandHandler<AssignRolesCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: AssignRolesCommand): Promise<AssignRolesResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    for (const roleId of command.roleIds) {
      user.addRole(roleId);
    }

    const savedUser = await this.userRepository.save(user);
    return { user: savedUser };
  }
}
