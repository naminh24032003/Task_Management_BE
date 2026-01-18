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
  (): RedisConfig => {
    if (!process.env.REDIS_HOST) {
      throw new Error('REDIS_HOST environment variable is required');
    }
    if (!process.env.REDIS_PASSWORD) {
      throw new Error('REDIS_PASSWORD environment variable is required');
    }

    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB, 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES, 10),
      retryStrategy: {
        maxRetryTime: parseInt(process.env.REDIS_RETRY_MAX_TIME || '30000', 10),
        retryDelayBase: parseInt(
          process.env.REDIS_RETRY_DELAY_BASE || '100',
          10,
        ),
      },
    };
  },
);
