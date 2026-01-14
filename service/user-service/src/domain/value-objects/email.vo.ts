import { InvalidEmailError } from '../errors/invalid-email.error';

/**
 * Email Value Object
 * Encapsulates email with validation
 */
export class Email {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  static create(email: string): Email {
    const normalized = email?.trim().toLowerCase();

    if (!normalized) {
      throw new InvalidEmailError('Email is required');
    }

    if (!this.EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailError(`Invalid email format: ${email}`);
    }

    if (normalized.length > 255) {
      throw new InvalidEmailError('Email is too long (max 255 characters)');
    }

    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.value.split('@')[0];
  }
}
