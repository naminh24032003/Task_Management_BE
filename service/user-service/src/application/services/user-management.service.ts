import { Injectable, Inject } from '@nestjs/common';
import { User, UserStatus } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { UserNotFoundError } from '../errors/user-not-found.error';

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  status?: UserStatus;
}

export interface ListUsersInput {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}

/**
 * User Management Service
 * Handles user CRUD operations
 */
@Injectable()
export class UserManagementService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Get user by ID
   */
  async getUserById(tenantId: string, userId: string): Promise<User> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.userRepository.findByEmail(tenantId, email);
  }

  /**
   * List users with pagination
   */
  async listUsers(
    tenantId: string,
    input: ListUsersInput,
  ): Promise<{ users: User[]; total: number }> {
    return this.userRepository.findAll(tenantId, input);
  }

  /**
   * Update user profile
   */
  async updateUser(
    tenantId: string,
    userId: string,
    input: UpdateUserInput,
  ): Promise<User> {
    const user = await this.getUserById(tenantId, userId);

    // Update profile
    if (input.firstName || input.lastName || input.displayName) {
      user.updateProfile({
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
      });
    }

    // Update status
    if (input.status) {
      switch (input.status) {
        case UserStatus.ACTIVE:
          user.activate();
          break;
        case UserStatus.INACTIVE:
          user.deactivate();
          break;
        case UserStatus.SUSPENDED:
          user.suspend();
          break;
        case UserStatus.DELETED:
          user.delete();
          break;
      }
    }

    return this.userRepository.save(user);
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const user = await this.getUserById(tenantId, userId);
    user.delete();
    await this.userRepository.save(user);
  }

  /**
   * Change user password
   */
  async changePassword(
    tenantId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.getUserById(tenantId, userId);
    user.changePassword(currentPassword, newPassword);
    await this.userRepository.save(user);
  }
}
