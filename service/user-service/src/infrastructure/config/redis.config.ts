import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
  connectTimeout: number;
  commandTimeout: number;
  maxRetriesPerRequest: number;
  retryStrategy: {
    maxRetryTime: number;
    retryDelayBase: number;
  };
}

export default registerAs(
  'redis',
  (): RedisConfig => ({
    host:
      process.env.REDIS_HOST ||
      'redis-cluster-master.redis.svc.cluster.local',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'user-service:',
    connectTimeout: parseInt(
      process.env.REDIS_CONNECT_TIMEOUT || '10000',
      10,
    ),
    commandTimeout: parseInt(
      process.env.REDIS_COMMAND_TIMEOUT || '5000',
      10,
    ),
    maxRetriesPerRequest: parseInt(
      process.env.REDIS_MAX_RETRIES || '3',
      10,
    ),
    retryStrategy: {
      maxRetryTime: parseInt(
        process.env.REDIS_RETRY_MAX_TIME || '30000',
        10,
      ),
      retryDelayBase: parseInt(
        process.env.REDIS_RETRY_DELAY_BASE || '100',
        10,
      ),
    },
  }),
);
