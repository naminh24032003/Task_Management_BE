import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';

/**
 * Guard to ensure tenant ID is present in the request
 * Can be skipped using @SkipTenantCheck() decorator
 * Extracts tenantId from header and attaches to request object
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenantCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant ID is required in x-tenant-id header',
      );
    }

    // Attach tenant ID to request for easy access in controllers/services
    request.tenantId = tenantId;

    return true;
  }
}
