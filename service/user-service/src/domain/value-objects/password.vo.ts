import * as crypto from 'crypto';
import { WeakPasswordError } from '../errors/weak-password.error';

/**
 * Password Value Object
 * Handles password hashing and validation
 */
export class Password {
  private constructor(
    private readonly hashedValue: string,
    private readonly salt: string,
  ) {
    Object.freeze(this);
  }

  /**
   * Create a new password from plain text
   */
  static create(plainPassword: string): Password {
    this.validateStrength(plainPassword);

    const salt = crypto.randomBytes(32).toString('hex');
    const hashedValue = this.hash(plainPassword, salt);

    return new Password(hashedValue, salt);
  }

  /**
   * Reconstitute password from stored hash and salt
   */
  static fromHash(hashedValue: string, salt: string): Password {
    return new Password(hashedValue, salt);
  }

  /**
   * Validate password strength
   */
  private static validateStrength(password: string): void {
    if (!password || password.length < 8) {
      throw new WeakPasswordError('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      throw new WeakPasswordError('Password must be at most 128 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new WeakPasswordError('Password must contain at least one special character');
    }
  }

  /**
   * Hash password with salt using PBKDF2
   */
  private static hash(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  /**
   * Verify if plain password matches
   */
  verify(plainPassword: string): boolean {
    const hashedAttempt = Password.hash(plainPassword, this.salt);
    return crypto.timingSafeEqual(
      Buffer.from(this.hashedValue),
      Buffer.from(hashedAttempt),
    );
  }

  getHash(): string {
    return this.hashedValue;
  }

  getSalt(): string {
    return this.salt;
  }
}
