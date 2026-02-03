import { Logger } from '@nestjs/common';

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

/**
 * Near Cache - In-memory L1 cache with TTL
 * Purpose: Ultra-fast reads for hot data, reduces Redis calls
 * Default TTL: 30 seconds
 */
export class NearCache<T = unknown> {
    private readonly logger = new Logger(NearCache.name);
    private readonly cache = new Map<string, CacheEntry<T>>();
    private readonly defaultTtlMs: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(defaultTtlSeconds = 30) {
        this.defaultTtlMs = defaultTtlSeconds * 1000;
        this.startCleanup();
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            let expired = 0;
            for (const [key, entry] of this.cache) {
                if (entry.expiresAt <= now) {
                    this.cache.delete(key);
                    expired++;
                }
            }
            if (expired > 0) {
                this.logger.debug(`Near cache cleanup: removed ${expired} expired entries`);
            }
        }, 10000);
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (entry.expiresAt <= Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key: string, data: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
        });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    deleteByPrefix(prefix: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.cache.clear();
    }
}
