import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../database/typeorm/repositories/user.repository';
import { RoleRepository } from '../../database/typeorm/repositories/role.repository';
import { PermissionRepository } from '../../database/typeorm/repositories/permission.repository';

/**
 * Service to resolve user permissions based on roles
 * Used by authentication to attach permissions to user object
 */
@Injectable()
export class PermissionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  /**
   * Get all permissions for a user based on their roles
   */
  async getUserPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    // Get user with roles
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user || !user.roleIds || user.roleIds.length === 0) {
      return [];
    }

    // Get all roles
    const roles = await this.roleRepository.findByIds(tenantId, user.roleIds);

    // Collect all unique permission IDs
    const permissionIds = new Set<string>();
    roles.forEach((role) => {
      role.permissionIds.forEach((id) => permissionIds.add(id));
    });

    // Get all permissions
    const permissions = await this.permissionRepository.findByIds(
      tenantId,
      Array.from(permissionIds),
    );

    // Return permission keys (e.g., "users:read", "tasks:write")
    return permissions.map((p) => p.key);
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(tenantId: string, userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user || !user.roleIds || user.roleIds.length === 0) {
      return [];
    }

    const roles = await this.roleRepository.findByIds(tenantId, user.roleIds);
    return roles.map((r) => r.name);
  }

  /**
   * Check if user has a specific permission
   */
  async userHasPermission(
    tenantId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(tenantId, userId);
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async userHasAnyPermission(
    tenantId: string,
    userId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(tenantId, userId);
    return requiredPermissions.some((p) => permissions.includes(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  async userHasAllPermissions(
    tenantId: string,
    userId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(tenantId, userId);
    return requiredPermissions.every((p) => permissions.includes(p));
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<boolean> {
    const roles = await this.getUserRoles(tenantId, userId);
    return roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  async userHasAnyRole(
    tenantId: string,
    userId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    const roles = await this.getUserRoles(tenantId, userId);
    return requiredRoles.some((r) => roles.includes(r));
  }
}
