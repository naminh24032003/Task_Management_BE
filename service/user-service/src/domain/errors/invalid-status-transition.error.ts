import { UserDomainError } from './user-domain.error';

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidStatusTransitionError extends UserDomainError {
  constructor(currentStatus: string, newStatus: string) {
    super(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
      'INVALID_STATUS_TRANSITION',
    );
  }
}
