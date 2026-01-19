import { WeakPasswordError } from '../errors/weak-password.error';

/**
 * Password Policy Configuration
 */
export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  specialChars: string;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
  maxConsecutiveChars: number;
  passwordHistoryCount: number;
  expirationDays: number;
}

/**
 * Validation result with details
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number;
}

/**
 * Common weak passwords list (subset)
 */
const COMMON_PASSWORDS = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'password1',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'password123',
];

/**
 * Password Policy Domain Service
 * Handles configurable password validation policies
 */
export class PasswordPolicyService {
  private readonly config: PasswordPolicyConfig;

  constructor(config?: Partial<PasswordPolicyConfig>) {
    this.config = {
      minLength: config?.minLength ?? 8,
      maxLength: config?.maxLength ?? 128,
      requireUppercase: config?.requireUppercase ?? true,
      requireLowercase: config?.requireLowercase ?? true,
      requireDigit: config?.requireDigit ?? true,
      requireSpecialChar: config?.requireSpecialChar ?? true,
      specialChars: config?.specialChars ?? '!@#$%^&*()_+-=[]{}|;:,.<>?',
      preventCommonPasswords: config?.preventCommonPasswords ?? true,
      preventUserInfoInPassword: config?.preventUserInfoInPassword ?? true,
      maxConsecutiveChars: config?.maxConsecutiveChars ?? 3,
      passwordHistoryCount: config?.passwordHistoryCount ?? 5,
      expirationDays: config?.expirationDays ?? 90,
    };
    Object.freeze(this.config);
  }

  /**
   * Get current policy configuration
   */
  getConfig(): PasswordPolicyConfig {
    return { ...this.config };
  }

  /**
   * Validate password against policy
   */
  validate(
    password: string,
    userInfo?: { email?: string; firstName?: string; lastName?: string },
  ): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length checks
    if (password.length < this.config.minLength) {
      errors.push(
        `Password must be at least ${this.config.minLength} characters`,
      );
    } else {
      score += 20;
    }

    if (password.length > this.config.maxLength) {
      errors.push(
        `Password cannot exceed ${this.config.maxLength} characters`,
      );
    }

    // Uppercase check
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    // Lowercase check
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    // Digit check
    if (this.config.requireDigit && !/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    // Special character check
    const specialRegex = new RegExp(
      `[${this.escapeRegex(this.config.specialChars)}]`,
    );
    if (this.config.requireSpecialChar && !specialRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (specialRegex.test(password)) {
      score += 20;
    }

    // Common password check
    if (
      this.config.preventCommonPasswords &&
      this.isCommonPassword(password)
    ) {
      errors.push('Password is too common');
    }

    // User info in password check
    if (this.config.preventUserInfoInPassword && userInfo) {
      if (this.containsUserInfo(password, userInfo)) {
        errors.push('Password cannot contain personal information');
      }
    }

    // Consecutive characters check
    if (this.hasConsecutiveChars(password, this.config.maxConsecutiveChars)) {
      errors.push(
        `Password cannot have more than ${this.config.maxConsecutiveChars} consecutive identical characters`,
      );
    }

    // Bonus for length
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine strength
    let strength: 'weak' | 'fair' | 'good' | 'strong';
    if (score < 40) strength = 'weak';
    else if (score < 60) strength = 'fair';
    else if (score < 80) strength = 'good';
    else strength = 'strong';

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  /**
   * Validate and throw error if invalid
   */
  validateOrThrow(
    password: string,
    userInfo?: { email?: string; firstName?: string; lastName?: string },
  ): void {
    const result = this.validate(password, userInfo);
    if (!result.isValid) {
      throw new WeakPasswordError(result.errors.join('. '));
    }
  }

  /**
   * Check if password is in history
   */
  isInHistory(
    password: string,
    passwordHistory: string[],
    hashFunction: (pwd: string) => string,
  ): boolean {
    const hashedPassword = hashFunction(password);
    return passwordHistory
      .slice(0, this.config.passwordHistoryCount)
      .includes(hashedPassword);
  }

  /**
   * Check if password is expired
   */
  isExpired(lastChangedAt: Date): boolean {
    if (this.config.expirationDays <= 0) return false;

    const expirationDate = new Date(lastChangedAt);
    expirationDate.setDate(
      expirationDate.getDate() + this.config.expirationDays,
    );

    return new Date() > expirationDate;
  }

  /**
   * Get days until password expires
   */
  getDaysUntilExpiration(lastChangedAt: Date): number {
    if (this.config.expirationDays <= 0) return Infinity;

    const expirationDate = new Date(lastChangedAt);
    expirationDate.setDate(
      expirationDate.getDate() + this.config.expirationDays,
    );

    const diffTime = expirationDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Generate password requirements message
   */
  getRequirementsMessage(): string {
    const requirements: string[] = [];

    requirements.push(
      `Must be ${this.config.minLength}-${this.config.maxLength} characters`,
    );

    if (this.config.requireUppercase) {
      requirements.push('at least one uppercase letter');
    }
    if (this.config.requireLowercase) {
      requirements.push('at least one lowercase letter');
    }
    if (this.config.requireDigit) {
      requirements.push('at least one digit');
    }
    if (this.config.requireSpecialChar) {
      requirements.push('at least one special character');
    }

    return `Password requirements: ${requirements.join(', ')}.`;
  }

  // Private helpers
  private isCommonPassword(password: string): boolean {
    return COMMON_PASSWORDS.includes(password.toLowerCase());
  }

  private containsUserInfo(
    password: string,
    userInfo: { email?: string; firstName?: string; lastName?: string },
  ): boolean {
    const lowerPassword = password.toLowerCase();

    if (userInfo.email) {
      const emailLocal = userInfo.email.split('@')[0].toLowerCase();
      if (emailLocal.length >= 3 && lowerPassword.includes(emailLocal)) {
        return true;
      }
    }

    if (
      userInfo.firstName &&
      userInfo.firstName.length >= 3 &&
      lowerPassword.includes(userInfo.firstName.toLowerCase())
    ) {
      return true;
    }

    if (
      userInfo.lastName &&
      userInfo.lastName.length >= 3 &&
      lowerPassword.includes(userInfo.lastName.toLowerCase())
    ) {
      return true;
    }

    return false;
  }

  private hasConsecutiveChars(password: string, maxConsecutive: number): boolean {
    if (maxConsecutive <= 0) return false;

    let consecutiveCount = 1;
    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        consecutiveCount++;
        if (consecutiveCount > maxConsecutive) {
          return true;
        }
      } else {
        consecutiveCount = 1;
      }
    }

    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\\-]/g, '\\$&');
  }
}

/**
 * Default password policy instance
 */
export const defaultPasswordPolicy = new PasswordPolicyService();
