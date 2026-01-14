import { ApplicationError } from './application.error';

/**
 * Error thrown when attempting to register with an existing email
 */
export class DuplicateEmailError extends ApplicationError {
  constructor(email: string) {
    super(`Email ${email} is already registered`, 'DUPLICATE_EMAIL', 409);
  }
}
