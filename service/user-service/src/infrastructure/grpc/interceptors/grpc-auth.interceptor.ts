import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

/**
 * User identity extracted from gRPC metadata headers
 * These headers are injected by Kong after JWT verification
 */
export interface GrpcUserIdentity {
  userId: string;
  tenantId: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

/**
 * Key to store user identity in the execution context
 */
export const GRPC_USER_IDENTITY = 'grpc_user_identity';

/**
 * gRPC Authentication Interceptor
 *
 * Extracts user identity from gRPC metadata headers injected by Kong:
 * - x-user-id: User ID from JWT sub claim
 * - x-tenant-id: Tenant ID from JWT tenantId claim
 * - x-email: User email from JWT email claim
 * - x-roles: Comma-separated roles from JWT roles claim
 * - x-permissions: Comma-separated permissions from JWT permissions claim
 *
 * The extracted identity is stored in the execution context for use by:
 * - Guards (AuthZ checks)
 * - Handlers (business logic)
 */
@Injectable()
export class GrpcAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const rpcContext = context.switchToRpc();
    const metadata = rpcContext.getContext() as Metadata;

    if (!metadata || !metadata.get) {
      return next.handle();
    }

    // Extract identity headers from metadata
    const userId = this.getMetadataValue(metadata, 'x-user-id');
    const tenantId = this.getMetadataValue(metadata, 'x-tenant-id');
    const email = this.getMetadataValue(metadata, 'x-email');
    const rolesStr = this.getMetadataValue(metadata, 'x-roles');
    const permissionsStr = this.getMetadataValue(metadata, 'x-permissions');

    // Build user identity object
    const identity: GrpcUserIdentity = {
      userId: userId || '',
      tenantId: tenantId || '',
      email: email,
      roles: rolesStr ? rolesStr.split(',').filter(Boolean) : [],
      permissions: permissionsStr ? permissionsStr.split(',').filter(Boolean) : [],
    };

    // Store identity in metadata for guards and handlers
    // We use a custom key to avoid conflicts
    metadata.set(GRPC_USER_IDENTITY, JSON.stringify(identity));

    return next.handle();
  }

  private getMetadataValue(metadata: Metadata, key: string): string | undefined {
    const values = metadata.get(key);
    if (values && values.length > 0) {
      return values[0].toString();
    }
    return undefined;
  }
}

/**
 * Helper function to extract user identity from gRPC execution context
 */
export function extractGrpcUserIdentity(context: ExecutionContext): GrpcUserIdentity | null {
  if (context.getType() !== 'rpc') {
    return null;
  }

  const rpcContext = context.switchToRpc();
  const metadata = rpcContext.getContext() as Metadata;

  if (!metadata || !metadata.get) {
    return null;
  }

  // Try to get from stored identity first (set by interceptor)
  const identityStr = metadata.get(GRPC_USER_IDENTITY)?.[0]?.toString();
  if (identityStr) {
    try {
      return JSON.parse(identityStr) as GrpcUserIdentity;
    } catch {
      // Fall through to extract from individual headers
    }
  }

  // Extract from individual headers as fallback
  const userId = metadata.get('x-user-id')?.[0]?.toString();
  const tenantId = metadata.get('x-tenant-id')?.[0]?.toString();
  const email = metadata.get('x-email')?.[0]?.toString();
  const rolesStr = metadata.get('x-roles')?.[0]?.toString();
  const permissionsStr = metadata.get('x-permissions')?.[0]?.toString();

  return {
    userId: userId || '',
    tenantId: tenantId || '',
    email: email,
    roles: rolesStr ? rolesStr.split(',').filter(Boolean) : [],
    permissions: permissionsStr ? permissionsStr.split(',').filter(Boolean) : [],
  };
}
