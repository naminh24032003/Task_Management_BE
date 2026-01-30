import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateUserStatusCommand } from './update-user-status.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User, UserStatus } from '../../../domain/aggregates/user.aggregate';
import { UpdateUserStatusResult } from '../../types';

export { UpdateUserStatusResult };

@CommandHandler(UpdateUserStatusCommand)
export class UpdateUserStatusHandler implements ICommandHandler<UpdateUserStatusCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: UpdateUserStatusCommand): Promise<UpdateUserStatusResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    switch (command.status) {
      case UserStatus.ACTIVE:
        user.activate();
        break;
      case UserStatus.INACTIVE:
        user.deactivate();
        break;
      case UserStatus.SUSPENDED:
        user.suspend();
        break;
      case UserStatus.DELETED:
        user.delete();
        break;
    }

    const savedUser = await this.userRepository.save(user);
    return { user: savedUser };
  }
}
