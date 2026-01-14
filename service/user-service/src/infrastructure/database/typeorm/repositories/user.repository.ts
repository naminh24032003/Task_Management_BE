import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { BaseTenantRepository } from './base.repository';

@Injectable()
export class UserRepository extends BaseTenantRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
  ) {
    super(repository);
  }

  /**
   * Find user by email within specified tenant
   */
  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.findOne(tenantId, {
      where: { email } as any,
    });
  }

  /**
   * Find user by email with password (for authentication)
   */
  async findByEmailWithPassword(tenantId: string, email: string): Promise<User | null> {
    return this.repository.findOne({
      where: {
        ...this.getTenantFilter(tenantId),
        email,
      } as any,
      select: ['_id', 'email', 'passwordHash', 'passwordSalt', 'status', 'tenantId', 'roleIds'],
    });
  }

  /**
   * Find users by role
   */
  async findByRole(tenantId: string, roleId: string): Promise<User[]> {
    return this.findAll(tenantId, {
      where: {
        roleIds: { $in: [roleId] } as any,
      } as any,
    });
  }

  /**
   * Find users by status
   */
  async findByStatus(tenantId: string, status: UserStatus): Promise<User[]> {
    return this.findAll(tenantId, {
      where: { status } as any,
    });
  }

  /**
   * Update user's last login
   */
  async updateLastLogin(tenantId: string, userId: string, ip?: string): Promise<void> {
    await this.update(tenantId, userId, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    } as Partial<User>);
  }

  /**
   * Verify user's email
   */
  async verifyEmail(tenantId: string, userId: string): Promise<void> {
    await this.update(tenantId, userId, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    } as Partial<User>);
  }

  /**
   * Add role to user
   */
  async addRole(tenantId: string, userId: string, roleId: string): Promise<User> {
    const user = await this.findByIdOrFail(tenantId, userId);
    if (!user.roleIds.includes(roleId)) {
      user.roleIds.push(roleId);
      return this.repository.save(user);
    }
    return user;
  }

  /**
   * Remove role from user
   */
  async removeRole(tenantId: string, userId: string, roleId: string): Promise<User> {
    const user = await this.findByIdOrFail(tenantId, userId);
    user.roleIds = user.roleIds.filter((id) => id !== roleId);
    return this.repository.save(user);
  }
}
