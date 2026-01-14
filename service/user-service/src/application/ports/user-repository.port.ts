import { User } from '../../domain/aggregates/user.aggregate';

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
   * Save user (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Find all users within tenant with pagination
   */
  findAll(
    tenantId: string,
    options: {
      page: number;
      pageSize: number;
      status?: string;
      search?: string;
    },
  ): Promise<{ users: User[]; total: number }>;

  /**
   * Delete user (soft delete)
   */
  delete(tenantId: string, userId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
