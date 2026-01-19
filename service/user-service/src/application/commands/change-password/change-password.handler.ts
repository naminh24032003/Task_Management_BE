import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ChangePasswordCommand } from './change-password.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserNotFoundError } from '../../errors/user-not-found.error';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<boolean> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);

    if (!user) {
      throw new UserNotFoundError(command.userId);
    }

    // Domain method validates current password and updates
    user.changePassword(command.currentPassword, command.newPassword);

    await this.userRepository.save(user);
    user.clearDomainEvents();

    return true;
  }
}
