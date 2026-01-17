import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when current password verification fails during password change
 */
export class PasswordMismatchError extends UserDomainError {
  constructor() {
    super('Current password is incorrect', 'PASSWORD_MISMATCH');
  }
}
