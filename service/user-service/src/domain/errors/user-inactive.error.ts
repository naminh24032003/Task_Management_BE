import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when an inactive user attempts an action
 */
export class UserInactiveError extends UserDomainError {
  constructor(userId: string) {
    super(`User ${userId} is inactive and cannot perform this action`, 'USER_INACTIVE');
  }
}
