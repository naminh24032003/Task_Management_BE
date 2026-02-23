import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cluster } from 'ioredis';

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

@Injectable()
export class RateLimitingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitingService.name);
  private redis: Cluster | null = null;

  constructor(private configService: ConfigService) {}

  // Token Bucket – Lua script chạy atomic trên Redis
  // Lưu { tokens, last_refill } trong Redis Hash
  private readonly TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('hmget', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + (elapsed / 1000) * refill_rate)
last_refill = now

local limited = 0
local retry_after = 0

if tokens >= 1 then
  tokens = tokens - 1
else
  limited = 1
  retry_after = math.ceil((1 - tokens) / refill_rate * 1000)
end

redis.call('hmset', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
redis.call('expire', key, math.ceil(capacity / refill_rate) + 60)

return {limited, math.floor(tokens), retry_after}
`;

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host');
      const port = this.configService.get<number>('redis.port');
      const password = this.configService.get<string>('redis.password');

      this.redis = new Cluster(
        [{ host, port }],
        {
          redisOptions: {
            password: password || undefined,
            keyPrefix: 'bff:ratelimit:',
          },
          clusterRetryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('Redis Cluster connection failed, rate limiting disabled');
              return null;
            }
            return Math.min(times * 100, 3000);
          },
        },
      );

      this.redis.on('connect', () => {
        this.logger.log('Redis Cluster connected for rate limiting');
      });

      this.redis.on('error', (error: Error) => {
        this.logger.warn(`Redis Cluster error: ${error.message}`);
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
      return { limited: false, remaining: limit, resetAt: 0, retryAfter: 0 };
    }

    try {
      const now = Date.now(); // milliseconds cho refill chính xác
      const capacity = limit;
      const refillRate = limit / windowSeconds; // tokens/giây
      const redisKey = `tb:${key}`;

      const result = (await this.redis.eval(
        this.TOKEN_BUCKET_SCRIPT,
        1,
        redisKey,
        capacity,
        refillRate,
        now,
      )) as [number, number, number];

      const [limited, remaining, retryAfterMs] = result;
      const retryAfter = Math.ceil(retryAfterMs / 1000);
      const resetAt = limited ? Math.floor(now / 1000) + retryAfter : 0;

      return {
        limited: limited === 1,
        remaining,
        resetAt,
        retryAfter,
      };
    } catch (error) {
      this.logger.error(`Rate limiting error: ${error}`);
      return { limited: false, remaining: limit, resetAt: 0, retryAfter: 0 };
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
