import { User, UserStatus } from '../aggregates/user.aggregate';

/**
 * Base Specification interface
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

/**
 * Abstract base class for specifications
 */
export abstract class AbstractSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification<T>(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification<T>(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification<T>(this);
  }
}

class AndSpecification<T> extends AbstractSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) &&
      this.right.isSatisfiedBy(candidate)
    );
  }
}

class OrSpecification<T> extends AbstractSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) ||
      this.right.isSatisfiedBy(candidate)
    );
  }
}

class NotSpecification<T> extends AbstractSpecification<T> {
  constructor(private readonly spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * User Active Status Specification
 * Checks if a user has active status
 */
export class UserActiveStatusSpecification extends AbstractSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.status === UserStatus.ACTIVE;
  }
}

/**
 * User Inactive Status Specification
 * Checks if a user has inactive status
 */
export class UserInactiveStatusSpecification extends AbstractSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.status === UserStatus.INACTIVE;
  }
}

/**
 * User Suspended Status Specification
 * Checks if a user is suspended
 */
export class UserSuspendedStatusSpecification extends AbstractSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.status === UserStatus.SUSPENDED;
  }
}

/**
 * User Deleted Status Specification
 * Checks if a user is deleted
 */
export class UserDeletedStatusSpecification extends AbstractSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.status === UserStatus.DELETED;
  }
}

/**
 * User Can Login Specification
 * Checks if a user can login (active status only)
 */
export class UserCanLoginSpecification extends AbstractSpecification<User> {
  private readonly activeSpec = new UserActiveStatusSpecification();

  isSatisfiedBy(user: User): boolean {
    return this.activeSpec.isSatisfiedBy(user);
  }
}

/**
 * User Status Specification Factory
 */
export class UserStatusSpecifications {
  static isActive(): UserActiveStatusSpecification {
    return new UserActiveStatusSpecification();
  }

  static isInactive(): UserInactiveStatusSpecification {
    return new UserInactiveStatusSpecification();
  }

  static isSuspended(): UserSuspendedStatusSpecification {
    return new UserSuspendedStatusSpecification();
  }

  static isDeleted(): UserDeletedStatusSpecification {
    return new UserDeletedStatusSpecification();
  }

  static canLogin(): UserCanLoginSpecification {
    return new UserCanLoginSpecification();
  }

  static isNotDeleted(): Specification<User> {
    return new UserDeletedStatusSpecification().not();
  }

  static isActiveOrInactive(): Specification<User> {
    return new UserActiveStatusSpecification().or(
      new UserInactiveStatusSpecification(),
    );
  }
}
