import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ChangeEmailCommand } from './change-email.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User } from '../../../domain/aggregates/user.aggregate';
import { UserEmailChangedEvent } from '../../integration-events/user-email-changed.event';

export interface ChangeEmailResult {
  user: User;
}

@CommandHandler(ChangeEmailCommand)
export class ChangeEmailHandler implements ICommandHandler<ChangeEmailCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ChangeEmailCommand): Promise<ChangeEmailResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if new email already exists
    const existingUser = await this.userRepository.findByEmail(command.tenantId, command.newEmail);
    if (existingUser && existingUser.id.toString() !== command.userId) {
      throw new Error('Email already in use');
    }

    const oldEmail = user.email.toString();

    // Change email
    user.changeEmail(command.newEmail);

    // Save the user
    const savedUser = await this.userRepository.save(user);

    // Publish domain event
    this.eventBus.publish(
      new UserEmailChangedEvent(
        command.userId,
        command.tenantId,
        oldEmail,
        command.newEmail,
      ),
    );

    return { user: savedUser };
  }
}
