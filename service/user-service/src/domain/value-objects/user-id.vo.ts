import { Types } from 'mongoose';

/**
 * UserId Value Object
 * Encapsulates user identifier with validation
 */
export class UserId {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  static create(id?: string): UserId {
    if (id) {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid user ID format');
      }
      return new UserId(id);
    }
    return new UserId(new Types.ObjectId().toString());
  }

  static fromString(id: string): UserId {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new Error('Invalid user ID format');
    }
    return new UserId(id);
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toObjectId(): Types.ObjectId {
    return new Types.ObjectId(this.value);
  }
}
