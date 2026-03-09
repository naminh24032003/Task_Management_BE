import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  /**
   * Unique ID for this request lifecycle.
   * Format: UUID v4, e.g. "550e8400-e29b-41d4-a716-446655440000"
   *
   * Source precedence:
   *   1. `x-request-id` header sent by the upstream client / Kong
   *   2. Auto-generated UUID if header is absent
   *
   * Echoed back in the response as `x-request-id`.
   * Forwarded to downstream gRPC calls via metadata key `x-request-id`.
   */
  requestId: string;

  /** ISO timestamp when the request arrived */
  startedAt: string;

  /** Tenant extracted by auth middleware (may be undefined on public routes) */
  tenantId?: string;

  /** User extracted by auth middleware (may be undefined on public routes) */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * RequestContextService
 *
 * Provides a per-request store backed by AsyncLocalStorage so that any
 * code running within the same async call chain (resolvers, services,
 * gRPC clients) can read the current request context without threading
 * it through every function signature.
 *
 * Lifecycle:
 *   1. RequestContextMiddleware.use() calls RequestContextService.run()
 *   2. The context is active for the entire async lifetime of the request
 *   3. After the response is sent the store is automatically GCed
 */
@Injectable()
export class RequestContextService {
  /** Start a new async context for this request. Call once per request in the middleware. */
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn) as T;
  }

  /** Access the current request context. Returns undefined outside of a request. */
  get(): RequestContext | undefined {
    return storage.getStore();
  }

  /** Current request ID — returns a fallback if called outside request context. */
  getRequestId(): string {
    return storage.getStore()?.requestId ?? randomUUID();
  }

  /** Current tenant ID. */
  getTenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  }

  /** Current user ID. */
  getUserId(): string | undefined {
    return storage.getStore()?.userId;
  }

  /** Enrich context with auth identity (called by auth guard/middleware after JWT validation). */
  setIdentity(userId: string, tenantId: string): void {
    const ctx = storage.getStore();
    if (ctx) {
      ctx.userId = userId;
      ctx.tenantId = tenantId;
    }
  }
}
