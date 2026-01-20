import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RpcException } from '@nestjs/microservices';
import { extractGrpcUserIdentity, GrpcUserIdentity } from '../interceptors/grpc-auth.interceptor';

/**
 * Decorator keys for roles and permissions
 */
export const GRPC_ROLES_KEY = 'grpc_required_roles';
export const GRPC_PERMISSIONS_KEY = 'grpc_required_permissions';
export const GRPC_SKIP_AUTH_KEY = 'grpc_skip_auth';

/**
 * gRPC Authentication Guard
 *
 * Verifies that the request has valid user identity extracted from
 * Kong-injected headers. Used for endpoints that require authentication.
 *
 * Usage:
 *   @UseGuards(GrpcAuthGuard)
 *   async getMe(request, metadata) { ... }
 */
@Injectable()
export class GrpcAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if auth should be skipped for this handler
    const skipAuth = this.reflector.getAllAndOverride<boolean>(
      GRPC_SKIP_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipAuth) {
      return true;
    }

    const identity = extractGrpcUserIdentity(context);

    if (!identity || !identity.userId) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated',
      });
    }

    if (!identity.tenantId) {
      throw new RpcException({
        code: 'INVALID_ARGUMENT',
        message: 'Tenant ID is required',
      });
    }

    return true;
  }
}

/**
 * gRPC Roles Guard
 *
 * Verifies that the authenticated user has at least one of the required roles.
 * Must be used after GrpcAuthGuard.
 *
 * Usage:
 *   @UseGuards(GrpcAuthGuard, GrpcRolesGuard)
 *   @GrpcRequireRoles('admin', 'manager')
 *   async deleteUser(request, metadata) { ... }
 */
@Injectable()
export class GrpcRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      GRPC_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const identity = extractGrpcUserIdentity(context);

    if (!identity || !identity.userId) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated',
      });
    }

    // Check if user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some((role) =>
      identity.roles.includes(role),
    );

    if (!hasRequiredRole) {
      throw new RpcException({
        code: 'PERMISSION_DENIED',
        message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      });
    }

    return true;
  }
}

/**
 * gRPC Permissions Guard
 *
 * Verifies that the authenticated user has ALL of the required permissions.
 * Must be used after GrpcAuthGuard.
 *
 * Usage:
 *   @UseGuards(GrpcAuthGuard, GrpcPermissionsGuard)
 *   @GrpcRequirePermissions('users:write', 'users:delete')
 *   async deleteUser(request, metadata) { ... }
 */
@Injectable()
export class GrpcPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      GRPC_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const identity = extractGrpcUserIdentity(context);

    if (!identity || !identity.userId) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated',
      });
    }

    // Check if user has ALL of the required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      identity.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new RpcException({
        code: 'PERMISSION_DENIED',
        message: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
      });
    }

    return true;
  }
}
