import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GRPC_ROLES_KEY, GRPC_PERMISSIONS_KEY, GRPC_SKIP_AUTH_KEY } from '../guards/grpc-auth.guard';
import { extractGrpcUserIdentity, GrpcUserIdentity } from '../interceptors/grpc-auth.interceptor';

/**
 * Decorator to require specific roles for a gRPC endpoint
 *
 * Usage:
 *   @GrpcRequireRoles('admin', 'manager')
 *   @UseGuards(GrpcAuthGuard, GrpcRolesGuard)
 *   async deleteUser(request, metadata) { ... }
 */
export const GrpcRequireRoles = (...roles: string[]) =>
  SetMetadata(GRPC_ROLES_KEY, roles);

/**
 * Decorator to require specific permissions for a gRPC endpoint
 *
 * Usage:
 *   @GrpcRequirePermissions('users:write', 'users:delete')
 *   @UseGuards(GrpcAuthGuard, GrpcPermissionsGuard)
 *   async deleteUser(request, metadata) { ... }
 */
export const GrpcRequirePermissions = (...permissions: string[]) =>
  SetMetadata(GRPC_PERMISSIONS_KEY, permissions);

/**
 * Decorator to skip authentication for a gRPC endpoint
 *
 * Usage:
 *   @GrpcSkipAuth()
 *   async login(request) { ... }
 */
export const GrpcSkipAuth = () => SetMetadata(GRPC_SKIP_AUTH_KEY, true);

/**
 * Parameter decorator to extract authenticated user identity from gRPC metadata
 *
 * Usage:
 *   async getMe(
 *     request: GetMeRequest,
 *     metadata: Metadata,
 *     @GrpcUser() user: GrpcUserIdentity
 *   ) { ... }
 */
export const GrpcUser = createParamDecorator(
  (data: keyof GrpcUserIdentity | undefined, ctx: ExecutionContext): GrpcUserIdentity | string | string[] | null => {
    const identity = extractGrpcUserIdentity(ctx);

    if (!identity) {
      return null;
    }

    // If a specific property is requested, return just that
    if (data) {
      return identity[data];
    }

    return identity;
  },
);

/**
 * Parameter decorator to extract user ID from gRPC metadata
 *
 * Usage:
 *   async getMe(
 *     request: GetMeRequest,
 *     metadata: Metadata,
 *     @GrpcUserId() userId: string
 *   ) { ... }
 */
export const GrpcUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const identity = extractGrpcUserIdentity(ctx);
    return identity?.userId || null;
  },
);

/**
 * Parameter decorator to extract tenant ID from gRPC metadata
 *
 * Usage:
 *   async listUsers(
 *     request: ListUsersRequest,
 *     metadata: Metadata,
 *     @GrpcTenantId() tenantId: string
 *   ) { ... }
 */
export const GrpcTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const identity = extractGrpcUserIdentity(ctx);
    return identity?.tenantId || null;
  },
);
