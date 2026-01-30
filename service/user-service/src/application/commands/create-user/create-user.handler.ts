import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateUserCommand } from './create-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { User, UserStatus } from '../../../domain/aggregates/user.aggregate';
import { UserRegisteredEvent } from '../../integration-events/user-registered.event';
import { CreateUserResult } from '../../types';

export { CreateUserResult };

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(command.tenantId, command.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create user with provided status or default to active
    const user = User.create({
      tenantId: command.tenantId,
      email: command.email,
      password: command.password,
      firstName: command.firstName,
      lastName: command.lastName,
      displayName: command.displayName,
      roleIds: command.roleIds,
    });

    // If status provided and different from default, update it
    if (command.status && command.status !== UserStatus.ACTIVE) {
      if (command.status === UserStatus.INACTIVE) {
        user.deactivate();
      } else if (command.status === UserStatus.SUSPENDED) {
        user.suspend();
      }
    }

    // Save the user
    const savedUser = await this.userRepository.save(user);

    // Publish domain event
    this.eventBus.publish(
      new UserRegisteredEvent(
        savedUser.id.toString(),
        savedUser.tenantId,
        savedUser.email.toString(),
        savedUser.firstName,
        savedUser.lastName,
      ),
    );

    return { user: savedUser };
  }
}
