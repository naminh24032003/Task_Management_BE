import { User } from '../aggregates/user.aggregate';
import { AbstractSpecification } from './user-active-status.specification';

/**
 * Email Uniqueness Check Interface
 * This is a domain interface that infrastructure must implement
 */
export interface EmailUniquenessChecker {
  isEmailUnique(tenantId: string, email: string, excludeUserId?: string): Promise<boolean>;
}

/**
 * User Email Unique Specification
 * Checks if a user's email is unique within the tenant
 * This is an async specification that requires a repository check
 */
export class UserEmailUniqueSpecification {
  constructor(private readonly emailChecker: EmailUniquenessChecker) {}

  /**
   * Check if email is unique (async)
   */
  async isSatisfiedBy(
    tenantId: string,
    email: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    return this.emailChecker.isEmailUnique(tenantId, email, excludeUserId);
  }

  /**
   * Check if user can change to new email (async)
   */
  async canChangeEmail(user: User, newEmail: string): Promise<boolean> {
    return this.emailChecker.isEmailUnique(
      user.tenantId,
      newEmail,
      user.id.toString(),
    );
  }
}

/**
 * User Email Domain Specification
 * Checks if email domain is allowed
 */
export class UserEmailDomainSpecification extends AbstractSpecification<User> {
  constructor(private readonly allowedDomains: string[]) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    const emailDomain = user.email.getDomain();
    return this.allowedDomains.includes(emailDomain.toLowerCase());
  }
}

/**
 * User Email Not Blocked Domain Specification
 * Checks if email domain is not in blocked list
 */
export class UserEmailNotBlockedDomainSpecification extends AbstractSpecification<User> {
  constructor(private readonly blockedDomains: string[]) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    const emailDomain = user.email.getDomain();
    return !this.blockedDomains.includes(emailDomain.toLowerCase());
  }
}

/**
 * User Email Verified Specification
 * Checks if user's email is verified
 * Note: Requires emailVerified field to be added to User aggregate
 */
export class UserEmailVerifiedSpecification extends AbstractSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    // If User aggregate has emailVerified field, use it
    // For now, return true as placeholder
    // TODO: Add emailVerified field to User aggregate if needed
    return true;
  }
}

/**
 * User Has Corporate Email Specification
 * Checks if user has a corporate (non-free) email domain
 */
export class UserHasCorporateEmailSpecification extends AbstractSpecification<User> {
  private readonly freeEmailDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'zoho.com',
  ];

  isSatisfiedBy(user: User): boolean {
    const emailDomain = user.email.getDomain().toLowerCase();
    return !this.freeEmailDomains.includes(emailDomain);
  }
}

/**
 * Email Specification Factory
 */
export class EmailSpecifications {
  /**
   * Create unique email specification (requires repository)
   */
  static unique(emailChecker: EmailUniquenessChecker): UserEmailUniqueSpecification {
    return new UserEmailUniqueSpecification(emailChecker);
  }

  /**
   * Create allowed domains specification
   */
  static allowedDomains(domains: string[]): UserEmailDomainSpecification {
    return new UserEmailDomainSpecification(domains);
  }

  /**
   * Create blocked domains specification
   */
  static notBlockedDomains(domains: string[]): UserEmailNotBlockedDomainSpecification {
    return new UserEmailNotBlockedDomainSpecification(domains);
  }

  /**
   * Create corporate email specification
   */
  static isCorporateEmail(): UserHasCorporateEmailSpecification {
    return new UserHasCorporateEmailSpecification();
  }

  /**
   * Create email verified specification
   */
  static isVerified(): UserEmailVerifiedSpecification {
    return new UserEmailVerifiedSpecification();
  }
}
