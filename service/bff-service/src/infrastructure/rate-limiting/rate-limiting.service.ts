import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

@Injectable()
export class RateLimitingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitingService.name);
  private redis: Redis | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host');
      const port = this.configService.get<number>('redis.port');
      const password = this.configService.get<string>('redis.password');
      const db = this.configService.get<number>('redis.db', 1);

      this.redis = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        keyPrefix: 'bff:ratelimit:',
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis connection failed, rate limiting disabled');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected for rate limiting');
      });

      this.redis.on('error', (error) => {
        this.logger.warn(`Redis error: ${error.message}`);
      });
    } catch (error) {
      this.logger.warn(`Failed to initialize Redis: ${error}. Rate limiting disabled.`);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis disconnected');
    }
  }

  async isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    if (!this.redis) {
      // If Redis is not available, allow the request
      return { limited: false, remaining: limit, resetAt: 0 };
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - (now % windowSeconds);
      const redisKey = `${key}:${windowStart}`;

      const count = await this.redis.incr(redisKey);

      // Set expiry on first request in window
      if (count === 1) {
        await this.redis.expire(redisKey, windowSeconds);
      }

      const remaining = Math.max(0, limit - count);
      const resetAt = windowStart + windowSeconds;

      return {
        limited: count > limit,
        remaining,
        resetAt,
      };
    } catch (error) {
      this.logger.error(`Rate limiting error: ${error}`);
      // On error, allow the request
      return { limited: false, remaining: limit, resetAt: 0 };
    }
  }

  async getRateLimitByUser(userId: string): Promise<RateLimitResult> {
    const limit = this.configService.get<number>('RATE_LIMIT_USER_LIMIT', 100);
    const window = this.configService.get<number>('RATE_LIMIT_USER_WINDOW', 60);
    return this.isRateLimited(`user:${userId}`, limit, window);
  }

  async getRateLimitByIp(ip: string): Promise<RateLimitResult> {
    const limit = this.configService.get<number>('RATE_LIMIT_IP_LIMIT', 50);
    const window = this.configService.get<number>('RATE_LIMIT_IP_WINDOW', 60);
    return this.isRateLimited(`ip:${ip}`, limit, window);
  }
}
