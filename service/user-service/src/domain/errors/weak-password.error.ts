import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when password does not meet strength requirements
 */
export class WeakPasswordError extends UserDomainError {
  constructor(message: string) {
    super(message, 'WEAK_PASSWORD');
  }
}
