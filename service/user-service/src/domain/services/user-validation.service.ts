import { User, UserStatus } from '../aggregates/user.aggregate';
import { Email } from '../value-objects/email.vo';
import { PasswordPolicyService } from './password-policy.service';

/**
 * User Validation Configuration
 */
export interface UserValidationConfig {
  minNameLength: number;
  maxNameLength: number;
  maxDisplayNameLength: number;
  allowedEmailDomains?: string[];
  blockedEmailDomains?: string[];
  maxRolesPerUser: number;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * User Validation Domain Service
 * Centralized validation logic for user-related operations
 */
export class UserValidationService {
  private readonly config: UserValidationConfig;
  private readonly passwordPolicy: PasswordPolicyService;

  constructor(
    config?: Partial<UserValidationConfig>,
    passwordPolicy?: PasswordPolicyService,
  ) {
    this.config = {
      minNameLength: config?.minNameLength ?? 1,
      maxNameLength: config?.maxNameLength ?? 100,
      maxDisplayNameLength: config?.maxDisplayNameLength ?? 200,
      allowedEmailDomains: config?.allowedEmailDomains,
      blockedEmailDomains: config?.blockedEmailDomains,
      maxRolesPerUser: config?.maxRolesPerUser ?? 50,
    };
    this.passwordPolicy = passwordPolicy ?? new PasswordPolicyService();
    Object.freeze(this.config);
  }

  /**
   * Validate user creation data
   */
  validateCreateUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    roleIds?: string[];
  }): ValidationResult {
    const errors: ValidationError[] = [];

    // Email validation
    const emailErrors = this.validateEmail(data.email);
    errors.push(...emailErrors);

    // Password validation
    const passwordResult = this.passwordPolicy.validate(data.password, {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    if (!passwordResult.isValid) {
      errors.push({
        field: 'password',
        message: passwordResult.errors.join('. '),
        code: 'WEAK_PASSWORD',
      });
    }

    // Name validation
    const nameErrors = this.validateNames(
      data.firstName,
      data.lastName,
      data.displayName,
    );
    errors.push(...nameErrors);

    // Roles validation
    if (data.roleIds) {
      const roleErrors = this.validateRoles(data.roleIds);
      errors.push(...roleErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate user update data
   */
  validateUpdateUser(data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    status?: UserStatus;
  }): ValidationResult {
    const errors: ValidationError[] = [];

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const nameErrors = this.validateNames(
        data.firstName ?? '',
        data.lastName ?? '',
        data.displayName,
      );
      errors.push(...nameErrors.filter((e) => {
        if (data.firstName === undefined && e.field === 'firstName') return false;
        if (data.lastName === undefined && e.field === 'lastName') return false;
        return true;
      }));
    }

    if (data.displayName !== undefined) {
      if (data.displayName.length > this.config.maxDisplayNameLength) {
        errors.push({
          field: 'displayName',
          message: `Display name cannot exceed ${this.config.maxDisplayNameLength} characters`,
          code: 'DISPLAY_NAME_TOO_LONG',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email
   */
  validateEmail(email: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const emailVO = Email.create(email);
      const domain = emailVO.getDomain();

      // Check allowed domains
      if (
        this.config.allowedEmailDomains &&
        this.config.allowedEmailDomains.length > 0
      ) {
        if (!this.config.allowedEmailDomains.includes(domain)) {
          errors.push({
            field: 'email',
            message: 'Email domain is not allowed',
            code: 'EMAIL_DOMAIN_NOT_ALLOWED',
          });
        }
      }

      // Check blocked domains
      if (this.config.blockedEmailDomains?.includes(domain)) {
        errors.push({
          field: 'email',
          message: 'Email domain is blocked',
          code: 'EMAIL_DOMAIN_BLOCKED',
        });
      }
    } catch {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    return errors;
  }

  /**
   * Validate names
   */
  validateNames(
    firstName: string,
    lastName: string,
    displayName?: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // First name validation
    if (firstName.length < this.config.minNameLength) {
      errors.push({
        field: 'firstName',
        message: `First name must be at least ${this.config.minNameLength} character(s)`,
        code: 'FIRST_NAME_TOO_SHORT',
      });
    }

    if (firstName.length > this.config.maxNameLength) {
      errors.push({
        field: 'firstName',
        message: `First name cannot exceed ${this.config.maxNameLength} characters`,
        code: 'FIRST_NAME_TOO_LONG',
      });
    }

    // Last name validation
    if (lastName.length < this.config.minNameLength) {
      errors.push({
        field: 'lastName',
        message: `Last name must be at least ${this.config.minNameLength} character(s)`,
        code: 'LAST_NAME_TOO_SHORT',
      });
    }

    if (lastName.length > this.config.maxNameLength) {
      errors.push({
        field: 'lastName',
        message: `Last name cannot exceed ${this.config.maxNameLength} characters`,
        code: 'LAST_NAME_TOO_LONG',
      });
    }

    // Display name validation
    if (displayName && displayName.length > this.config.maxDisplayNameLength) {
      errors.push({
        field: 'displayName',
        message: `Display name cannot exceed ${this.config.maxDisplayNameLength} characters`,
        code: 'DISPLAY_NAME_TOO_LONG',
      });
    }

    // Check for invalid characters
    const nameRegex = /^[\p{L}\p{M}\s\-'.]+$/u;
    if (firstName && !nameRegex.test(firstName)) {
      errors.push({
        field: 'firstName',
        message: 'First name contains invalid characters',
        code: 'FIRST_NAME_INVALID_CHARS',
      });
    }

    if (lastName && !nameRegex.test(lastName)) {
      errors.push({
        field: 'lastName',
        message: 'Last name contains invalid characters',
        code: 'LAST_NAME_INVALID_CHARS',
      });
    }

    return errors;
  }

  /**
   * Validate roles
   */
  validateRoles(roleIds: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (roleIds.length > this.config.maxRolesPerUser) {
      errors.push({
        field: 'roleIds',
        message: `User cannot have more than ${this.config.maxRolesPerUser} roles`,
        code: 'TOO_MANY_ROLES',
      });
    }

    // Check for duplicates
    const uniqueRoles = new Set(roleIds);
    if (uniqueRoles.size !== roleIds.length) {
      errors.push({
        field: 'roleIds',
        message: 'Duplicate roles are not allowed',
        code: 'DUPLICATE_ROLES',
      });
    }

    // Check for empty role IDs
    if (roleIds.some((id) => !id || id.trim() === '')) {
      errors.push({
        field: 'roleIds',
        message: 'Role IDs cannot be empty',
        code: 'EMPTY_ROLE_ID',
      });
    }

    return errors;
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(
    currentStatus: UserStatus,
    newStatus: UserStatus,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Define valid transitions
    const validTransitions: Record<UserStatus, UserStatus[]> = {
      [UserStatus.ACTIVE]: [
        UserStatus.INACTIVE,
        UserStatus.SUSPENDED,
        UserStatus.DELETED,
      ],
      [UserStatus.INACTIVE]: [
        UserStatus.ACTIVE,
        UserStatus.SUSPENDED,
        UserStatus.DELETED,
      ],
      [UserStatus.SUSPENDED]: [
        UserStatus.ACTIVE,
        UserStatus.INACTIVE,
        UserStatus.DELETED,
      ],
      [UserStatus.DELETED]: [], // Cannot transition from deleted
    };

    if (currentStatus === newStatus) {
      // Same status is okay, no transition needed
      return { isValid: true, errors: [] };
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      errors.push({
        field: 'status',
        message: `Cannot transition from ${currentStatus} to ${newStatus}`,
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if user can perform action based on status
   */
  canPerformAction(user: User, action: string): boolean {
    const statusRestrictions: Record<UserStatus, string[]> = {
      [UserStatus.ACTIVE]: [], // No restrictions
      [UserStatus.INACTIVE]: ['login', 'createContent'],
      [UserStatus.SUSPENDED]: ['login', 'createContent', 'updateProfile'],
      [UserStatus.DELETED]: [
        'login',
        'createContent',
        'updateProfile',
        'any',
      ],
    };

    const restrictions = statusRestrictions[user.status] || [];
    return !restrictions.includes(action) && !restrictions.includes('any');
  }
}

/**
 * Default user validation service instance
 */
export const defaultUserValidationService = new UserValidationService();
