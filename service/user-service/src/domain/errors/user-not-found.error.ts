import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when a user is not found
 */
export class UserNotFoundError extends UserDomainError {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`, 'USER_NOT_FOUND');
  }
}
