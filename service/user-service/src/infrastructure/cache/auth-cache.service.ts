import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import {
  IAuthCacheService,
  CachedSession,
  CachedRefreshToken,
} from '../../application/ports/auth-cache.port';

/**
 * JWKS key data
 */
export interface JwksKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

/**
 * Cached JWKS data
 */
export interface CachedJwks {
  keys: JwksKey[];
  updatedAt: number;
}

/**
 * Cache key prefixes for auth-related data
 */
const CACHE_KEYS = {
  ACCESS_TOKEN: 'auth:access_token:',
  REFRESH_TOKEN: 'auth:refresh_token:',
  PERMISSIONS: 'auth:permissions:',
  ROLES: 'auth:roles:',
  JWKS: 'auth:jwks:current',
} as const;

/**
 * Default TTL values in seconds
 */
const DEFAULT_TTL = {
  PERMISSIONS: 600,        // 10 minutes
  ROLES: 600,              // 10 minutes
  JWKS: 900,               // 15 minutes
  REFRESH_TOKEN: 604800,   // 7 days
} as const;

/**
 * Redis Implementation of Auth Cache Service
 *
 * Provides caching for authentication/authorization data:
 * - Access token sessions (TTL: token exp)
 * - Refresh tokens (TTL: 7 days)
 * - User permissions (TTL: 10 minutes)
 * - User roles (TTL: 10 minutes)
 * - JWKS public keys (TTL: 15 minutes)
 *
 * Cache hit rate should be 99%+ for auth requests in production.
 */
@Injectable()
export class AuthCacheService implements IAuthCacheService, OnModuleInit {
  private readonly logger = new Logger(AuthCacheService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async onModuleInit() {
    try {
      await this.redis.ping();
      this.logger.log('Redis connection verified for AuthCacheService');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  /**
   * Hash access token for cache key (security: don't store raw tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ==================== ACCESS TOKEN / SESSION ====================

  /**
   * Cache access token session data
   * TTL is calculated from token expiration
   */
  async cacheSession(
    accessToken: string,
    session: CachedSession,
  ): Promise<void> {
    const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);
    const ttl = Math.max(1, session.exp - Math.floor(Date.now() / 1000));

    await this.redis.setex(key, ttl, JSON.stringify(session));
    this.logger.debug(`Cached session for user ${session.userId}, TTL: ${ttl}s`);
  }

  /**
   * Get cached session from access token
   */
  async getSession(accessToken: string): Promise<CachedSession | null> {
    const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);
    const data = await this.redis.get(key);

    if (!data) {
      this.logger.debug('Session cache miss');
      return null;
    }

    this.logger.debug('Session cache hit');
    return JSON.parse(data) as CachedSession;
  }

  /**
   * Invalidate session cache (logout, token revocation)
   */
  async invalidateSession(accessToken: string): Promise<void> {
    const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);
    await this.redis.del(key);
    this.logger.debug('Session invalidated');
  }

  // ==================== REFRESH TOKEN ====================

  /**
   * Store refresh token in cache
   */
  async storeRefreshToken(
    jti: string,
    data: CachedRefreshToken,
    ttlSeconds: number = DEFAULT_TTL.REFRESH_TOKEN,
  ): Promise<void> {
    const key = CACHE_KEYS.REFRESH_TOKEN + jti;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    this.logger.debug(`Stored refresh token ${jti.substring(0, 8)}...`);
  }

  /**
   * Get refresh token data
   */
  async getRefreshToken(jti: string): Promise<CachedRefreshToken | null> {
    const key = CACHE_KEYS.REFRESH_TOKEN + jti;
    const data = await this.redis.get(key);

    if (!data) {
      this.logger.debug('Refresh token not found in cache');
      return null;
    }

    return JSON.parse(data) as CachedRefreshToken;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(jti: string): Promise<void> {
    const key = CACHE_KEYS.REFRESH_TOKEN + jti;
    await this.redis.del(key);
    this.logger.debug(`Revoked refresh token ${jti.substring(0, 8)}...`);
  }

  /**
   * Revoke all refresh tokens for a user (force logout all devices)
   */
  async revokeAllUserRefreshTokens(userId: string): Promise<number> {
    const pattern = `${CACHE_KEYS.REFRESH_TOKEN}*`;
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const token = JSON.parse(data) as CachedRefreshToken;
          if (token.userId === userId) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }
    } while (cursor !== '0');

    this.logger.log(`Revoked ${deletedCount} refresh tokens for user ${userId}`);
    return deletedCount;
  }

  // ==================== PERMISSIONS ====================

  /**
   * Cache user permissions
   */
  async cachePermissions(
    tenantId: string,
    userId: string,
    permissions: string[],
    ttlSeconds: number = DEFAULT_TTL.PERMISSIONS,
  ): Promise<void> {
    const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(permissions));
    this.logger.debug(`Cached ${permissions.length} permissions for user ${userId}`);
  }

  /**
   * Get cached permissions
   */
  async getPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[] | null> {
    const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;
    const data = await this.redis.get(key);

    if (!data) {
      this.logger.debug(`Permissions cache miss for user ${userId}`);
      return null;
    }

    this.logger.debug(`Permissions cache hit for user ${userId}`);
    return JSON.parse(data) as string[];
  }

  /**
   * Invalidate user permissions cache
   * Call this when user roles/permissions are updated
   */
  async invalidatePermissions(tenantId: string, userId: string): Promise<void> {
    const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;
    await this.redis.del(key);
    this.logger.debug(`Invalidated permissions cache for user ${userId}`);
  }

  // ==================== ROLES ====================

  /**
   * Cache user roles
   */
  async cacheRoles(
    tenantId: string,
    userId: string,
    roles: string[],
    ttlSeconds: number = DEFAULT_TTL.ROLES,
  ): Promise<void> {
    const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(roles));
    this.logger.debug(`Cached ${roles.length} roles for user ${userId}`);
  }

  /**
   * Get cached roles
   */
  async getRoles(tenantId: string, userId: string): Promise<string[] | null> {
    const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;
    const data = await this.redis.get(key);

    if (!data) {
      this.logger.debug(`Roles cache miss for user ${userId}`);
      return null;
    }

    this.logger.debug(`Roles cache hit for user ${userId}`);
    return JSON.parse(data) as string[];
  }

  /**
   * Invalidate user roles cache
   */
  async invalidateRoles(tenantId: string, userId: string): Promise<void> {
    const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;
    await this.redis.del(key);
    this.logger.debug(`Invalidated roles cache for user ${userId}`);
  }

  // ==================== JWKS / PUBLIC KEY ====================

  /**
   * Cache JWKS public keys
   */
  async cacheJwks(
    jwks: CachedJwks,
    ttlSeconds: number = DEFAULT_TTL.JWKS,
  ): Promise<void> {
    await this.redis.setex(CACHE_KEYS.JWKS, ttlSeconds, JSON.stringify(jwks));
    this.logger.debug(`Cached JWKS with ${jwks.keys.length} keys`);
  }

  /**
   * Get cached JWKS
   */
  async getJwks(): Promise<CachedJwks | null> {
    const data = await this.redis.get(CACHE_KEYS.JWKS);

    if (!data) {
      this.logger.debug('JWKS cache miss');
      return null;
    }

    this.logger.debug('JWKS cache hit');
    return JSON.parse(data) as CachedJwks;
  }

  /**
   * Invalidate JWKS cache (key rotation)
   */
  async invalidateJwks(): Promise<void> {
    await this.redis.del(CACHE_KEYS.JWKS);
    this.logger.debug('Invalidated JWKS cache');
  }

  // ==================== CACHE UTILITIES ====================

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    sessionKeys: number;
    refreshTokenKeys: number;
    permissionKeys: number;
    roleKeys: number;
  }> {
    const countKeys = async (pattern: string): Promise<number> => {
      let count = 0;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          1000,
        );
        cursor = nextCursor;
        count += keys.length;
      } while (cursor !== '0');

      return count;
    };

    const [sessionKeys, refreshTokenKeys, permissionKeys, roleKeys] =
      await Promise.all([
        countKeys(CACHE_KEYS.ACCESS_TOKEN + '*'),
        countKeys(CACHE_KEYS.REFRESH_TOKEN + '*'),
        countKeys(CACHE_KEYS.PERMISSIONS + '*'),
        countKeys(CACHE_KEYS.ROLES + '*'),
      ]);

    return {
      totalKeys: sessionKeys + refreshTokenKeys + permissionKeys + roleKeys,
      sessionKeys,
      refreshTokenKeys,
      permissionKeys,
      roleKeys,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
      };
    }
  }
}
