import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when authentication credentials are invalid
 */
export class InvalidCredentialsError extends UserDomainError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}
