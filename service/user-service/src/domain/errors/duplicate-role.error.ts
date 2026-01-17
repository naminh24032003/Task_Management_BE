import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when attempting to add a duplicate role to a user
 */
export class DuplicateRoleError extends UserDomainError {
  constructor(roleId: string) {
    super(`Role ${roleId} is already assigned to this user`, 'DUPLICATE_ROLE');
  }
}
