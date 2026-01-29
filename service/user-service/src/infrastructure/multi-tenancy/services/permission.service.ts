import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../application/ports/user-repository.port';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../../application/ports/role-repository.port';
import {
  IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '../../../application/ports/permission-repository.port';
import {
  IAuthCacheService,
  AUTH_CACHE_SERVICE,
} from '../../../application/ports/auth-cache.port';

/**
 * Service to resolve user permissions based on roles
 * Used by authentication to attach permissions to user object
 *
 * Uses Redis cache for high performance:
 * - 99%+ cache hit rate target
 * - TTL: 10 minutes for permissions and roles
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
    @Inject(AUTH_CACHE_SERVICE)
    private readonly authCache: IAuthCacheService,
  ) { }

  /**
   * Get all permissions for a user based on their roles
   * Uses cache-first strategy for 99%+ cache hit rate
   */
  async getUserPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    // Try cache first (99%+ hit rate target)
    const cached = await this.authCache.getPermissions(tenantId, userId);
    if (cached) {
      this.logger.debug(`Permissions cache hit for user ${userId}`);
      return cached;
    }

    this.logger.debug(`Permissions cache miss for user ${userId}, loading from DB`);

    // Cache miss - load from database
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
    const permissionKeys = permissions.map((p) => p.key);

    // Cache for subsequent requests
    await this.authCache.cachePermissions(tenantId, userId, permissionKeys);

    return permissionKeys;
  }

  /**
   * Get all roles for a user
   * Uses cache-first strategy for 99%+ cache hit rate
   */
  async getUserRoles(tenantId: string, userId: string): Promise<string[]> {
    // Try cache first
    const cached = await this.authCache.getRoles(tenantId, userId);
    if (cached) {
      this.logger.debug(`Roles cache hit for user ${userId}`);
      return cached;
    }

    this.logger.debug(`Roles cache miss for user ${userId}, loading from DB`);

    const user = await this.userRepository.findById(tenantId, userId);
    if (!user || !user.roleIds || user.roleIds.length === 0) {
      return [];
    }

    const roles = await this.roleRepository.findByIds(tenantId, user.roleIds);
    const roleNames = roles.map((r) => r.name);

    // Cache for subsequent requests
    await this.authCache.cacheRoles(tenantId, userId, roleNames);

    return roleNames;
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

  /**
   * Invalidate user's permission cache
   * Call this when user roles/permissions are updated
   */
  async invalidateUserPermissionCache(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.authCache.invalidatePermissions(tenantId, userId);
    this.logger.log(`Invalidated permission cache for user ${userId}`);
  }

  /**
   * Invalidate user's role cache
   * Call this when user roles are updated
   */
  async invalidateUserRoleCache(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.authCache.invalidateRoles(tenantId, userId);
    this.logger.log(`Invalidated role cache for user ${userId}`);
  }

  /**
   * Invalidate all cache for a user (permissions + roles)
   * Call this when user is updated, deleted, or roles changed
   */
  async invalidateAllUserCache(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await Promise.all([
      this.authCache.invalidatePermissions(tenantId, userId),
      this.authCache.invalidateRoles(tenantId, userId),
    ]);
    this.logger.log(`Invalidated all cache for user ${userId}`);
  }
}
