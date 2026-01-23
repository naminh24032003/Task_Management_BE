import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';

/**
 * Guard to ensure tenant ID is present in the request
 * Can be skipped using @SkipTenantCheck() decorator
 * Supports both HTTP and gRPC contexts
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenantCheck) {
      this.logger.log('Skipping tenant check');
      return true;
    }

    // Check context type and extract tenant ID accordingly
    const contextType = context.getType();
    let tenantId: string | undefined;

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      tenantId = request?.headers?.['x-tenant-id'];
      if (tenantId) {
        request.tenantId = tenantId;
      }
    } else if (contextType === 'rpc') {
      // For gRPC, try to get tenant_id from metadata
      const rpcContext = context.switchToRpc();
      const metadata = rpcContext.getContext();

      // Try to get from gRPC metadata headers
      if (metadata && typeof metadata.get === 'function') {
        const metaTenantId = metadata.get('x-tenant-id');
        tenantId = metaTenantId?.[0]?.toString();
      } else if (metadata) {
        // Support plain object metadata
        tenantId = metadata['x-tenant-id'] || metadata['tenant-id'] || metadata['tenantid'];
      }

      // If not in metadata, try to get from request body (for Auth endpoints)
      if (!tenantId) {
        const data = rpcContext.getData();
        tenantId = data?.tenantId || data?.tenant_id;
      }
    }

    if (!tenantId) {
      const data = contextType === 'rpc' ? context.switchToRpc().getData() : {};
      this.logger.error(`Tenant ID not found. Context: ${contextType}, Data keys: ${Object.keys(data || {})}`);
      throw new BadRequestException(
        'Tenant ID is required (x-tenant-id header or tenant_id in request)',
      );
    }

    this.logger.log(`Tenant ID found: ${tenantId}`);

    return true;
  }
}
