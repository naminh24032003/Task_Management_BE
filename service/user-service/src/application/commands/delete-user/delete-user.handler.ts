import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteUserCommand } from './delete-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserDeletedEvent } from '../../integration-events/user-deleted.event';
import { DeleteUserResult } from '../../types';

export { DeleteUserResult };

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteUserCommand): Promise<DeleteUserResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Delete the user (soft delete)
    await this.userRepository.delete(command.tenantId, command.userId);

    // Publish domain event
    this.eventBus.publish(
      new UserDeletedEvent(
        command.userId,
        command.tenantId,
        user.email.toString(),
      ),
    );

    return { success: true };
  }
}
