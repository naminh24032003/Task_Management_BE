import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * KongAuthGuard - Extracts user identity from Kong-injected headers
 *
 * Kong validates JWT and injects these headers:
 * - x-user-id: User ID from JWT sub claim
 * - x-tenant-id: Tenant ID from JWT
 * - x-email: User email from JWT
 * - x-roles: Comma-separated roles from JWT
 * - x-permissions: Comma-separated permissions from JWT
 *
 * This guard trusts Kong's authentication and simply extracts the identity.
 */
@Injectable()
export class KongAuthGuard implements CanActivate {
  private readonly logger = new Logger(KongAuthGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    // Extract Kong-injected headers
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];
    const email = req.headers['x-email'];
    const rolesHeader = req.headers['x-roles'];
    const permissionsHeader = req.headers['x-permissions'];

    // If Kong didn't inject user ID, request is not authenticated
    if (!userId) {
      this.logger.warn('Request without x-user-id header - Kong auth may have failed');
      throw new UnauthorizedException('Not authenticated');
    }

    // Parse roles and permissions from comma-separated strings
    const roles = rolesHeader ? rolesHeader.split(',').map((r: string) => r.trim()).filter(Boolean) : [];
    const permissions = permissionsHeader ? permissionsHeader.split(',').map((p: string) => p.trim()).filter(Boolean) : [];

    // Attach user to request
    req.user = {
      sub: userId,
      tenantId: tenantId || '',
      email: email || '',
      roles,
      permissions,
    };

    this.logger.debug(`Authenticated user: ${userId} with roles: ${roles.join(', ')}`);
    return true;
  }
}
