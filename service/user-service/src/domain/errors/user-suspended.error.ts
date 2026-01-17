import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when a suspended user attempts an action
 */
export class UserSuspendedError extends UserDomainError {
  constructor(userId: string) {
    super(`User ${userId} is suspended and cannot perform this action`, 'USER_SUSPENDED');
  }
}
