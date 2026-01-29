/**
 * Cached user session data
 */
export interface CachedSession {
    userId: string;
    tenantId: string;
    email: string;
    roles: string[];
    scopes: string[];
    exp: number;
}

/**
 * Cached refresh token data
 */
export interface CachedRefreshToken {
    userId: string;
    tenantId: string;
    createdAt: number;
}

/**
 * Auth Cache Service Port (Interface)
 * Defines the contract for authentication caching operations
 * 
 * Implementations:
 * - RedisAuthCacheService (production)
 * - InMemoryAuthCacheService (testing)
 */
export interface IAuthCacheService {
    /**
     * Cache access token session data
     */
    cacheSession(accessToken: string, session: CachedSession): Promise<void>;

    /**
     * Get cached session from access token
     */
    getSession(accessToken: string): Promise<CachedSession | null>;

    /**
     * Invalidate session cache
     */
    invalidateSession(accessToken: string): Promise<void>;

    /**
     * Store refresh token in cache
     */
    storeRefreshToken(
        jti: string,
        data: CachedRefreshToken,
        ttlSeconds?: number,
    ): Promise<void>;

    /**
     * Get refresh token data
     */
    getRefreshToken(jti: string): Promise<CachedRefreshToken | null>;

    /**
     * Revoke refresh token
     */
    revokeRefreshToken(jti: string): Promise<void>;

    /**
     * Revoke all refresh tokens for a user
     */
    revokeAllUserRefreshTokens(userId: string): Promise<number>;

    /**
     * Cache user permissions
     */
    cachePermissions(
        tenantId: string,
        userId: string,
        permissions: string[],
        ttlSeconds?: number,
    ): Promise<void>;

    /**
     * Get cached permissions
     */
    getPermissions(tenantId: string, userId: string): Promise<string[] | null>;

    /**
     * Invalidate permissions cache
     */
    invalidatePermissions(tenantId: string, userId: string): Promise<void>;

    /**
     * Cache user roles
     */
    cacheRoles(
        tenantId: string,
        userId: string,
        roles: string[],
        ttlSeconds?: number,
    ): Promise<void>;

    /**
     * Get cached roles
     */
    getRoles(tenantId: string, userId: string): Promise<string[] | null>;

    /**
     * Invalidate roles cache
     */
    invalidateRoles(tenantId: string, userId: string): Promise<void>;

    /**
     * Health check
     */
    healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number }>;
}

export const AUTH_CACHE_SERVICE = Symbol('IAuthCacheService');
