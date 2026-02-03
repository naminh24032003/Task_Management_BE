import * as argon2 from 'argon2';
import { WeakPasswordError } from '../errors/weak-password.error';

/**
 * Argon2 Configuration
 * 
 * Argon2id is the recommended variant (hybrid of Argon2i and Argon2d)
 * - memoryCost: 65536 KB (64 MB) - memory-hard to prevent GPU attacks
 * - timeCost: 3 iterations - balance between security and speed
 * - parallelism: 4 threads
 * 
 * Expected latency: ~50-80ms (vs ~300ms with PBKDF2 100k iterations)
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 iterations
  parallelism: 4,     // 4 threads
  hashLength: 32,     // 256 bits output
};

/**
 * Password Value Object
 * 
 * Uses Argon2id for password hashing - winner of Password Hashing Competition (2015)
 * Provides memory-hard hashing resistant to GPU/ASIC attacks.
 * 
 * All hashing operations are async to avoid blocking the event loop.
 */
export class Password {
  private constructor(
    private readonly hashedValue: string,
    private readonly salt: string, // salt is embedded in Argon2 hash, this is for backward compat
  ) {
    Object.freeze(this);
  }

  /**
   * Create a new password from plain text (async)
   * Uses Argon2id for secure hashing
   */
  static async create(plainPassword: string): Promise<Password> {
    this.validateStrength(plainPassword);

    // Argon2 automatically generates salt and embeds in hash
    const hashedValue = await argon2.hash(plainPassword, ARGON2_OPTIONS);

    // Store 'ARGON2' as salt marker to indicate new hash format
    return new Password(hashedValue, 'ARGON2');
  }

  /**
   * Reconstitute password from stored hash and salt
   */
  static fromHash(hashedValue: string, salt: string): Password {
    return new Password(hashedValue, salt);
  }

  /**
   * Create empty password for OAuth users
   */
  static createEmpty(): Password {
    return new Password('OAUTH_USER_NO_PASSWORD', 'OAUTH_USER_NO_SALT');
  }

  /**
   * Check if this is an OAuth user (no password)
   */
  isOAuthUser(): boolean {
    return this.hashedValue === 'OAUTH_USER_NO_PASSWORD';
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
   * Verify if plain password matches (async - non-blocking)
   * 
   * Supports both Argon2 (new) and PBKDF2 (legacy) hashes for backward compatibility
   */
  async verify(plainPassword: string): Promise<boolean> {
    // Check if this is an Argon2 hash (starts with $argon2)
    if (this.hashedValue.startsWith('$argon2')) {
      return argon2.verify(this.hashedValue, plainPassword);
    }

    // Legacy PBKDF2 hash - for backward compatibility with existing users
    const crypto = await import('crypto');
    const hashedAttempt = crypto
      .pbkdf2Sync(plainPassword, this.salt, 100000, 64, 'sha512')
      .toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(this.hashedValue),
      Buffer.from(hashedAttempt),
    );
  }

  /**
   * Check if this password needs rehashing (legacy PBKDF2 → Argon2)
   */
  needsRehash(): boolean {
    return !this.hashedValue.startsWith('$argon2') && !this.isOAuthUser();
  }

  getHash(): string {
    return this.hashedValue;
  }

  getSalt(): string {
    return this.salt;
  }
}
