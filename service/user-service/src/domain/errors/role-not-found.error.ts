import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when attempting to remove a role that doesn't exist on user
 */
export class RoleNotFoundError extends UserDomainError {
  constructor(roleId: string) {
    super(`Role ${roleId} is not assigned to this user`, 'ROLE_NOT_FOUND');
  }
}
