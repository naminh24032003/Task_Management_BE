import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// ─────────────────────────────────────────────────────────────────────────────
// Cache Policy Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache policy types for HTTP responses.
 *
 * | Policy   | Who can cache | TTL            | Use case                        |
 * |----------|---------------|----------------|---------------------------------|
 * | NO_STORE | Nobody        | —              | Auth, tokens, PII data          |
 * | NO_CACHE | Browser only  | Revalidate     | Dynamic user-specific data      |
 * | PRIVATE  | Browser only  | Short TTL      | Logged-in user content (GET)    |
 * | PUBLIC   | CDN + Browser | 5 min / 1 min  | Public read-only endpoints      |
 * | STATIC   | CDN + Browser | 1 year         | Immutable versioned assets      |
 * | HEALTH   | Nobody        | —              | Health/probe/metrics endpoints  |
 */
export enum CachePolicyType {
  /** Never cache — credentials, tokens, PII */
  NO_STORE = 'no-store',

  /** Revalidate on every use — dynamic user data */
  NO_CACHE = 'no-cache',

  /** Browser-only private cache — authenticated content */
  PRIVATE = 'private',

  /** CDN + browser cacheable — public read data */
  PUBLIC = 'public',

  /** Immutable public assets — long TTL */
  STATIC = 'static',

  /** K8s probes / metrics — never cache */
  HEALTH = 'health',
}

export interface CachePolicyOptions {
  type: CachePolicyType;

  /** Override browser max-age (seconds). Only relevant for PUBLIC / PRIVATE. */
  maxAge?: number;

  /** CDN s-maxage (seconds). Only relevant for PUBLIC. */
  sMaxAge?: number;

  /** stale-while-revalidate (seconds). */
  staleWhileRevalidate?: number;

  /** Extra values merged into the Vary header. */
  vary?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// @CachePolicy() Decorator
// ─────────────────────────────────────────────────────────────────────────────

export const CACHE_POLICY_KEY = '__cache_policy__';

/**
 * Attach a cache policy to a route handler or controller.
 *
 * @example
 * // Auth endpoint — never cache, ever
 * @CachePolicy(CachePolicyType.NO_STORE)
 * async login(@Body() dto: LoginDto) {}
 *
 * @example
 * // Public catalog — CDN cacheable for 5 minutes
 * @CachePolicy({ type: CachePolicyType.PUBLIC, sMaxAge: 300 })
 * async listPublicCategories() {}
 */
export const CachePolicy = (
  options: CachePolicyOptions | CachePolicyType,
): MethodDecorator & ClassDecorator =>
  SetMetadata(
    CACHE_POLICY_KEY,
    typeof options === 'string' ? { type: options } : options,
  );

// ─────────────────────────────────────────────────────────────────────────────
// Base Header Definitions per Policy
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderMap {
  [key: string]: string;
}

const BASE_HEADERS: Record<CachePolicyType, HeaderMap> = {
  /**
   * NO_STORE: Absolutely nothing may be stored anywhere.
   * Required for: login, token refresh, any endpoint returning credentials/PII.
   * RFC 9111 §5.2.2.5 — no-store supersedes all other directives.
   */
  [CachePolicyType.NO_STORE]: {
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',              // HTTP/1.0 backward compat
    'Surrogate-Control': 'no-store',   // CDN: Fastly, Varnish, CloudFront
  },

  /**
   * NO_CACHE: Stored but must revalidate with origin before reuse.
   * Required for: frequently changing authenticated resources.
   */
  [CachePolicyType.NO_CACHE]: {
    'Cache-Control': 'no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store',
    'Vary': 'Authorization, Accept-Encoding',
  },

  /**
   * PRIVATE: Browser can cache, CDN must not.
   * Suitable for: authenticated GET responses (user profile, tasks list, etc.).
   */
  [CachePolicyType.PRIVATE]: {
    'Cache-Control': 'private, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store',
    'Vary': 'Authorization, Accept-Encoding',
  },

  /**
   * PUBLIC: CDN + browser cacheable.
   * Defaults: browser 5 min, CDN 1 min, SWR 30 s.
   * Suitable for: public catalog pages, reference data.
   */
  [CachePolicyType.PUBLIC]: {
    'Cache-Control': 'public, max-age=300, s-maxage=60, stale-while-revalidate=30',
    'Surrogate-Control': 'max-age=60',
    'Vary': 'Accept-Encoding, Accept',
  },

  /**
   * STATIC: Immutable versioned assets — aggressive long-term caching.
   * Filename MUST include a content hash (e.g. main.abc123.js).
   */
  [CachePolicyType.STATIC]: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Surrogate-Control': 'max-age=31536000',
    'Vary': 'Accept-Encoding',
  },

  /**
   * HEALTH: K8s liveness, readiness, and Prometheus metrics endpoints.
   * Values change every second — must never be cached.
   */
  [CachePolicyType.HEALTH]: {
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Surrogate-Control': 'no-store',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detection Rules
// ─────────────────────────────────────────────────────────────────────────────

/** Paths that always get the HEALTH policy regardless of HTTP method. */
const HEALTH_PATH = /^\/(health|healthz|live|liveness|ready|readyz|readiness|metrics)/i;

/** HTTP methods that semantically modify state — must never be cached. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─────────────────────────────────────────────────────────────────────────────
// Interceptor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CacheControlInterceptor
 *
 * Automatically sets `Cache-Control` and related security headers on every
 * HTTP response.  Honours `@CachePolicy()` decorators; falls back to
 * sensible auto-detected defaults.
 *
 * Register globally via APP_INTERCEPTOR so Reflector DI works correctly:
 *
 * @example
 * // app.module.ts
 * providers: [
 *   { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
 * ]
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only HTTP — gRPC / WebSocket contexts are unaffected
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse();
    const req = context.switchToHttp().getRequest();
    const policy = this.resolvePolicy(context, req);

    this.applyHeaders(res, policy, req);

    return next.handle().pipe(
      tap(() => {
        // Re-apply if a downstream handler or interceptor wiped Cache-Control
        if (!res.getHeader('Cache-Control')) {
          this.applyHeaders(res, policy, req);
        }
      }),
    );
  }

  // ── Policy resolution ──────────────────────────────────────────────────────

  private resolvePolicy(
    context: ExecutionContext,
    req: any,
  ): CachePolicyOptions {
    // 1. Explicit decorator wins — handler takes priority over class
    const metadata = this.reflector.getAllAndOverride<CachePolicyOptions>(
      CACHE_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (metadata) return metadata;

    // 2. Probe / metrics paths → HEALTH
    const path: string = req.path ?? req.url ?? '';
    if (HEALTH_PATH.test(path)) {
      return { type: CachePolicyType.HEALTH };
    }

    // 3. Mutating methods → NO_STORE (state-changing responses must not be replayed)
    const method: string = (req.method ?? 'GET').toUpperCase();
    if (MUTATING_METHODS.has(method)) {
      return { type: CachePolicyType.NO_STORE };
    }

    // 4. Authenticated GET → PRIVATE (safe default for user data)
    return { type: CachePolicyType.PRIVATE };
  }

  // ── Header application ─────────────────────────────────────────────────────

  private applyHeaders(
    res: any,
    policy: CachePolicyOptions,
    req: any,
  ): void {
    const headers: HeaderMap = {
      ...(BASE_HEADERS[policy.type] ?? BASE_HEADERS[CachePolicyType.NO_STORE]),
    };

    // Override max-age
    if (policy.maxAge !== undefined && headers['Cache-Control']) {
      headers['Cache-Control'] = headers['Cache-Control'].replace(
        /max-age=\d+/,
        `max-age=${policy.maxAge}`,
      );
    }

    // Override / inject s-maxage
    if (policy.sMaxAge !== undefined && headers['Cache-Control']) {
      headers['Cache-Control'] = headers['Cache-Control'].includes('s-maxage')
        ? headers['Cache-Control'].replace(/s-maxage=\d+/, `s-maxage=${policy.sMaxAge}`)
        : `${headers['Cache-Control']}, s-maxage=${policy.sMaxAge}`;
      headers['Surrogate-Control'] = `max-age=${policy.sMaxAge}`;
    }

    // Override / inject stale-while-revalidate
    if (policy.staleWhileRevalidate !== undefined && headers['Cache-Control']) {
      headers['Cache-Control'] = headers['Cache-Control'].includes('stale-while-revalidate')
        ? headers['Cache-Control'].replace(
            /stale-while-revalidate=\d+/,
            `stale-while-revalidate=${policy.staleWhileRevalidate}`,
          )
        : `${headers['Cache-Control']}, stale-while-revalidate=${policy.staleWhileRevalidate}`;
    }

    // Merge extra Vary values
    if (policy.vary?.length) {
      const existing = headers['Vary'] ? headers['Vary'].split(', ') : [];
      headers['Vary'] = Array.from(new Set([...existing, ...policy.vary])).join(', ');
    }

    // HSTS — only set when request arrived over HTTPS (Kong / Nginx TLS termination)
    const isHttps =
      req.headers?.['x-forwarded-proto'] === 'https' || req.secure === true;
    if (isHttps) {
      headers['Strict-Transport-Security'] =
        'max-age=31536000; includeSubDomains; preload';
    }

    // Write to response
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    // Audit header — Kong / Nginx can strip this at the edge before sending to client
    res.setHeader('X-Cache-Policy', policy.type);
  }
}
