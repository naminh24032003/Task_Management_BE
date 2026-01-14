import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when email validation fails
 */
export class InvalidEmailError extends UserDomainError {
  constructor(message: string) {
    super(message, 'INVALID_EMAIL');
  }
}
