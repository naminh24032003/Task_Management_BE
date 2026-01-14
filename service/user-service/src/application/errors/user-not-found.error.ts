import { ApplicationError } from './application.error';

/**
 * Error thrown when user is not found
 */
export class UserNotFoundError extends ApplicationError {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`, 'USER_NOT_FOUND', 404);
  }
}
