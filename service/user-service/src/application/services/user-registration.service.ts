import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { User } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { DuplicateEmailError } from '../errors/duplicate-email.error';

export interface RegisterUserInput {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
}

/**
 * User Registration Service
 * Handles user registration business logic
 */
@Injectable()
export class UserRegistrationService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Register a new user
   */
  async register(input: RegisterUserInput): Promise<User> {
    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(
      input.tenantId,
      input.email,
    );

    if (emailExists) {
      throw new DuplicateEmailError(input.email);
    }

    // Create user aggregate (validates email, password strength)
    const user = User.create({
      tenantId: input.tenantId,
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
    });

    // Persist user
    const savedUser = await this.userRepository.save(user);

    // Clear domain events after persistence
    savedUser.clearDomainEvents();

    return savedUser;
  }
}
