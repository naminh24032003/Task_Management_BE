import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ChangePasswordCommand } from './change-password.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserNotFoundError } from '../../errors/user-not-found.error';
import { ChangePasswordResult } from '../../types';

export { ChangePasswordResult };

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) { }

  async execute(command: ChangePasswordCommand): Promise<ChangePasswordResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);

    if (!user) {
      throw new UserNotFoundError(command.userId);
    }

    // Domain method validates current password and updates (async - non-blocking PBKDF2)
    await user.changePassword(command.currentPassword, command.newPassword);

    await this.userRepository.save(user);
    user.clearDomainEvents();

    return { success: true };
  }
}
