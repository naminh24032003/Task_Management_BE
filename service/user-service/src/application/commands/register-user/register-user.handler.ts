import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterUserCommand } from './register-user.command';
import { User } from '../../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { DuplicateEmailError } from '../../errors/duplicate-email.error';
import { UserRegisteredEvent } from '../../integration-events/user-registered.event';

export interface RegisterUserResult {
  user: User;
  success: boolean;
  message: string;
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(
      command.tenantId,
      command.email,
    );

    if (emailExists) {
      throw new DuplicateEmailError(command.email);
    }

    // Create user aggregate
    const user = User.create({
      tenantId: command.tenantId,
      email: command.email,
      password: command.password,
      firstName: command.firstName,
      lastName: command.lastName,
      displayName: command.displayName,
    });

    // Persist user
    const savedUser = await this.userRepository.save(user);

    // Publish integration event
    this.eventBus.publish(
      new UserRegisteredEvent(
        savedUser.id.toString(),
        savedUser.tenantId,
        savedUser.email.toString(),
        savedUser.firstName,
        savedUser.lastName,
      ),
    );

    // Clear domain events
    savedUser.clearDomainEvents();

    return {
      user: savedUser,
      success: true,
      message: 'User registered successfully. Please login to continue.',
    };
  }
}
