import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RegisterUserCommand } from './register-user.command';
import { User } from '../../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { DuplicateEmailError } from '../../errors/duplicate-email.error';
import { UserRegisteredEvent } from '../../integration-events/user-registered.event';
import { RegisterUserResult } from '../../types';

export { RegisterUserResult };

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  private readonly logger = new Logger(RegisterUserHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) { }

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    this.logger.log(`RegisterUser process started for email: ${command.email}`);

    try {
      // Step 1: Check if email already exists
      const emailExists = await this.userRepository.emailExists(
        command.tenantId,
        command.email,
      );

      if (emailExists) {
        throw new DuplicateEmailError(command.email);
      }

      // Step 2: Create user aggregate (async due to password hashing)
      const user = await User.create({
        tenantId: command.tenantId,
        email: command.email,
        password: command.password,
        firstName: command.firstName,
        lastName: command.lastName,
        displayName: command.displayName,
      });

      // Step 3: Persist user to database
      const savedUser = await this.userRepository.save(user);

      // Step 4: Publish integration event
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

      this.logger.log(`RegisterUser completed successfully for user: ${savedUser.id}`);

      return {
        user: savedUser,
        success: true,
        message: 'User registered successfully. Please login to continue.',
      };
    } catch (error: any) {
      this.logger.error(`RegisterUser failed: ${error.message}`);
      throw error;
    }
  }
}
