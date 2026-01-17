import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when attempting to create a user that already exists
 */
export class UserAlreadyExistsError extends UserDomainError {
  constructor(email: string) {
    super(`User with email ${email} already exists`, 'USER_ALREADY_EXISTS');
  }
}
