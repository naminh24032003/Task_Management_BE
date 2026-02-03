import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import {
    IAuthCacheService,
    CachedSession,
    CachedRefreshToken,
} from '../../application/ports/auth-cache.port';
import { IEventPublisher, EVENT_PUBLISHER } from '../../application/ports/event-publisher.port';
import { NearCache } from './near-cache';
import { SingleFlight } from './single-flight';

const CACHE_KEYS = {
    ACCESS_TOKEN: 'auth:access_token:',
    REFRESH_TOKEN: 'auth:refresh_token:',
    PERMISSIONS: 'auth:permissions:',
    ROLES: 'auth:roles:',
    USER_PROFILE: 'cache:user:profile:',
} as const;

const TTL = {
    NEAR_CACHE: 30,          // 30 seconds
    REDIS_PERMISSIONS: 300,  // 5 minutes
    REDIS_ROLES: 300,        // 5 minutes  
    REDIS_PROFILE: 180,      // 3 minutes
    REFRESH_TOKEN: 604800,   // 7 days
} as const;

interface UserProfile {
    userId: string;
    tenantId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    roleIds: string[];
}

/**
 * Multi-Tier Cache Service
 * 
 * Cache hierarchy (fastest to slowest):
 * 1. Near Cache (30s TTL) - In-memory, ~1μs
 * 2. SingleFlight - Prevents duplicate requests
 * 3. Redis (1-5m TTL) - Distributed, ~1ms
 * 4. Database - Source of truth, ~10-100ms
 * 
 * Write strategy:
 * 1. Write to DB
 * 2. Publish event to Kafka
 * 3. Invalidate Redis + Near cache
 */
@Injectable()
export class MultiTierCacheService implements IAuthCacheService, OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MultiTierCacheService.name);

    private readonly nearCache = new NearCache(TTL.NEAR_CACHE);
    private readonly singleFlight = new SingleFlight();

    constructor(
        @InjectRedis() private readonly redis: Redis,
        @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    ) { }

    async onModuleInit() {
        await this.redis.ping();
        this.logger.log('MultiTierCacheService initialized');
    }

    onModuleDestroy() {
        this.nearCache.destroy();
        this.singleFlight.clear();
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    // ==================== SESSION ====================

    async cacheSession(accessToken: string, session: CachedSession): Promise<void> {
        const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);
        const ttl = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
        const data = JSON.stringify(session);

        this.nearCache.set(key, session, Math.min(ttl, TTL.NEAR_CACHE));
        await this.redis.setex(key, ttl, data);
    }

    async getSession(accessToken: string): Promise<CachedSession | null> {
        const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);

        const nearCached = this.nearCache.get(key) as CachedSession | null;
        if (nearCached) {
            return nearCached;
        }

        return this.singleFlight.do(key, async () => {
            const data = await this.redis.get(key);
            if (!data) return null;

            const session = JSON.parse(data) as CachedSession;
            this.nearCache.set(key, session, TTL.NEAR_CACHE);
            return session;
        });
    }

    async invalidateSession(accessToken: string): Promise<void> {
        const key = CACHE_KEYS.ACCESS_TOKEN + this.hashToken(accessToken);
        this.nearCache.delete(key);
        await this.redis.del(key);
    }

    // ==================== REFRESH TOKEN ====================

    async storeRefreshToken(jti: string, data: CachedRefreshToken, ttlSeconds = TTL.REFRESH_TOKEN): Promise<void> {
        const key = CACHE_KEYS.REFRESH_TOKEN + jti;
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    }

    async getRefreshToken(jti: string): Promise<CachedRefreshToken | null> {
        const key = CACHE_KEYS.REFRESH_TOKEN + jti;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async revokeRefreshToken(jti: string): Promise<void> {
        const key = CACHE_KEYS.REFRESH_TOKEN + jti;
        await this.redis.del(key);
    }

    async revokeAllUserRefreshTokens(userId: string): Promise<number> {
        const pattern = `${CACHE_KEYS.REFRESH_TOKEN}*`;
        let cursor = '0';
        let deletedCount = 0;

        do {
            const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
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

        return deletedCount;
    }

    // ==================== PERMISSIONS ====================

    async cachePermissions(tenantId: string, userId: string, permissions: string[], ttlSeconds = TTL.REDIS_PERMISSIONS): Promise<void> {
        const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;
        const data = JSON.stringify(permissions);

        this.nearCache.set(key, permissions, TTL.NEAR_CACHE);
        await this.redis.setex(key, ttlSeconds, data);
    }

    async getPermissions(tenantId: string, userId: string): Promise<string[] | null> {
        const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;

        const nearCached = this.nearCache.get(key) as string[] | null;
        if (nearCached) {
            return nearCached;
        }

        return this.singleFlight.do(key, async () => {
            const data = await this.redis.get(key);
            if (!data) return null;

            const permissions = JSON.parse(data) as string[];
            this.nearCache.set(key, permissions, TTL.NEAR_CACHE);
            return permissions;
        });
    }

    async invalidatePermissions(tenantId: string, userId: string): Promise<void> {
        const key = `${CACHE_KEYS.PERMISSIONS}${tenantId}:${userId}`;
        this.nearCache.delete(key);
        await this.redis.del(key);
        this.logger.debug(`Invalidated permissions: ${userId}`);
    }

    // ==================== ROLES ====================

    async cacheRoles(tenantId: string, userId: string, roles: string[], ttlSeconds = TTL.REDIS_ROLES): Promise<void> {
        const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;
        const data = JSON.stringify(roles);

        this.nearCache.set(key, roles, TTL.NEAR_CACHE);
        await this.redis.setex(key, ttlSeconds, data);
    }

    async getRoles(tenantId: string, userId: string): Promise<string[] | null> {
        const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;

        const nearCached = this.nearCache.get(key) as string[] | null;
        if (nearCached) {
            return nearCached;
        }

        return this.singleFlight.do(key, async () => {
            const data = await this.redis.get(key);
            if (!data) return null;

            const roles = JSON.parse(data) as string[];
            this.nearCache.set(key, roles, TTL.NEAR_CACHE);
            return roles;
        });
    }

    async invalidateRoles(tenantId: string, userId: string): Promise<void> {
        const key = `${CACHE_KEYS.ROLES}${tenantId}:${userId}`;
        this.nearCache.delete(key);
        await this.redis.del(key);
        this.logger.debug(`Invalidated roles: ${userId}`);
    }

    // ==================== USER PROFILE ====================

    async cacheUserProfile(tenantId: string, userId: string, profile: UserProfile): Promise<void> {
        const key = `${CACHE_KEYS.USER_PROFILE}${tenantId}:${userId}`;
        const data = JSON.stringify(profile);

        this.nearCache.set(key, profile, TTL.NEAR_CACHE);
        await this.redis.setex(key, TTL.REDIS_PROFILE, data);
    }

    async getUserProfile(tenantId: string, userId: string): Promise<UserProfile | null> {
        const key = `${CACHE_KEYS.USER_PROFILE}${tenantId}:${userId}`;

        const nearCached = this.nearCache.get(key) as UserProfile | null;
        if (nearCached) {
            return nearCached;
        }

        return this.singleFlight.do(key, async () => {
            const data = await this.redis.get(key);
            if (!data) return null;

            const profile = JSON.parse(data) as UserProfile;
            this.nearCache.set(key, profile, TTL.NEAR_CACHE);
            return profile;
        });
    }

    async invalidateUserProfile(tenantId: string, userId: string): Promise<void> {
        const key = `${CACHE_KEYS.USER_PROFILE}${tenantId}:${userId}`;
        this.nearCache.delete(key);
        await this.redis.del(key);
    }

    // ==================== CACHE INVALIDATION ====================

    async invalidateUserCache(tenantId: string, userId: string): Promise<void> {
        await Promise.all([
            this.invalidatePermissions(tenantId, userId),
            this.invalidateRoles(tenantId, userId),
            this.invalidateUserProfile(tenantId, userId),
        ]);
        this.logger.log(`Invalidated all cache for user ${userId}`);
    }

    async publishCacheInvalidation(tenantId: string, userId: string, reason: string): Promise<void> {
        await this.invalidateUserCache(tenantId, userId);

        await this.eventPublisher.publishUserEvent('cache.invalidated', {
            userId,
            tenantId,
            reason,
            timestamp: new Date().toISOString(),
        });
    }

    // ==================== HEALTH CHECK ====================

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number }> {
        const start = Date.now();
        try {
            await this.redis.ping();
            return { status: 'healthy', latencyMs: Date.now() - start };
        } catch {
            return { status: 'unhealthy', latencyMs: Date.now() - start };
        }
    }

    getStats(): { nearCacheSize: number; singleFlightSize: number } {
        return {
            nearCacheSize: this.nearCache.size(),
            singleFlightSize: this.singleFlight.size(),
        };
    }
}
