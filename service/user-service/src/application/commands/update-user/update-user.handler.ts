import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateUserCommand } from './update-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User, UserStatus } from '../../../domain/aggregates/user.aggregate';
import { UpdateUserResult } from '../../types';

export { UpdateUserResult };

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UpdateUserResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update profile if any profile fields provided
    if (command.firstName || command.lastName || command.displayName) {
      user.updateProfile({
        firstName: command.firstName,
        lastName: command.lastName,
        displayName: command.displayName,
      });
    }

    // Update status if provided
    if (command.status) {
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
    }

    const savedUser = await this.userRepository.save(user);
    return { user: savedUser };
  }
}
