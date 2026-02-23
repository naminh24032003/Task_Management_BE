import { User } from '../../domain/aggregates/user.aggregate';
import { ListUsersDto } from '../dtos';

export interface FindAllResult {
  users: User[];
  total: number;
}

export interface FindAllWithCursorResult {
  users: User[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

/**
 * User Repository Port (Interface)
 * Defines the contract for user persistence operations
 */
export interface IUserRepository {
  /**
   * Find user by ID within tenant
   */
  findById(tenantId: string, userId: string): Promise<User | null>;

  /**
   * Find user by email within tenant
   */
  findByEmail(tenantId: string, email: string): Promise<User | null>;

  /**
   * Check if email exists within tenant
   */
  emailExists(tenantId: string, email: string): Promise<boolean>;

  /**
   * Check if email is unique within tenant (optionally excluding a user)
   */
  isEmailUnique(tenantId: string, email: string, excludeUserId?: string): Promise<boolean>;

  /**
   * Save user (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Find all users within tenant with offset pagination
   */
  findAll(
    tenantId: string,
    options: ListUsersDto,
  ): Promise<FindAllResult>;

  /**
   * Find all users within tenant with cursor-based pagination
   */
  findAllWithCursor(
    tenantId: string,
    options: ListUsersDto,
  ): Promise<FindAllWithCursorResult>;

  /**
   * Delete user (soft delete)
   */
  delete(tenantId: string, userId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
