import { Injectable, Inject } from '@nestjs/common';
import { User, UserStatus } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { UserNotFoundError } from '../errors/user-not-found.error';
import { DuplicateEmailError } from '../errors/duplicate-email.error';
import { CreateUserDto, UpdateUserDto, ListUsersDto } from '../dtos';

/**
 * User Management Service
 * Handles user CRUD operations
 */
@Injectable()
export class UserManagementService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) { }

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
    input: ListUsersDto,
  ): Promise<{ users: User[]; total: number }> {
    return this.userRepository.findAll(tenantId, input);
  }

  /**
   * Update user profile
   */
  async updateUser(
    tenantId: string,
    userId: string,
    input: UpdateUserDto,
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
    await user.changePassword(currentPassword, newPassword);
    await this.userRepository.save(user);
  }

  /**
   * Create user (admin operation)
   */
  async createUser(input: CreateUserDto): Promise<User> {
    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(input.tenantId, input.email);
    if (emailExists) {
      throw new DuplicateEmailError(input.email);
    }

    const user = await User.create({
      tenantId: input.tenantId,
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      roleIds: input.roleIds,
    });

    // Set custom status if provided
    if (input.status && input.status !== UserStatus.ACTIVE) {
      switch (input.status) {
        case UserStatus.INACTIVE:
          user.deactivate();
          break;
        case UserStatus.SUSPENDED:
          user.suspend();
          break;
      }
    }

    return this.userRepository.save(user);
  }

  /**
   * Change user email
   */
  async changeEmail(
    tenantId: string,
    userId: string,
    newEmail: string,
  ): Promise<User> {
    // Check if new email already exists
    const emailExists = await this.userRepository.emailExists(tenantId, newEmail);
    if (emailExists) {
      throw new DuplicateEmailError(newEmail);
    }

    const user = await this.getUserById(tenantId, userId);
    user.changeEmail(newEmail);
    return this.userRepository.save(user);
  }

  /**
   * Activate user
   */
  async activateUser(tenantId: string, userId: string): Promise<User> {
    const user = await this.getUserById(tenantId, userId);
    user.activate();
    return this.userRepository.save(user);
  }

  /**
   * Deactivate user
   */
  async deactivateUser(tenantId: string, userId: string): Promise<User> {
    const user = await this.getUserById(tenantId, userId);
    user.deactivate();
    return this.userRepository.save(user);
  }

  /**
   * Suspend user
   */
  async suspendUser(tenantId: string, userId: string): Promise<User> {
    const user = await this.getUserById(tenantId, userId);
    user.suspend();
    return this.userRepository.save(user);
  }

  /**
   * Assign roles to user
   */
  async assignRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
  ): Promise<User> {
    const user = await this.getUserById(tenantId, userId);
    for (const roleId of roleIds) {
      user.addRole(roleId);
    }
    return this.userRepository.save(user);
  }

  /**
   * Remove roles from user
   */
  async removeRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
  ): Promise<User> {
    const user = await this.getUserById(tenantId, userId);
    for (const roleId of roleIds) {
      user.removeRole(roleId);
    }
    return this.userRepository.save(user);
  }
}
