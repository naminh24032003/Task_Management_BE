import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import redisConfig, { RedisConfig } from '../config/redis.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<RedisConfig>('redis');
        const logger = new Logger('RedisModule');

        logger.log(`Connecting to Redis at ${config.host}:${config.port}`);

        return {
          type: 'single',
          options: {
            host: config.host,
            port: config.port,
            password: config.password || undefined,
            db: config.db,
            keyPrefix: config.keyPrefix,
            connectTimeout: config.connectTimeout,
            commandTimeout: config.commandTimeout,
            maxRetriesPerRequest: config.maxRetriesPerRequest,
            retryStrategy: (times: number) => {
              if (
                times * config.retryStrategy.retryDelayBase >
                config.retryStrategy.maxRetryTime
              ) {
                logger.error(
                  `Redis connection failed after ${times} retries`,
                );
                return null;
              }
              const delay = Math.min(
                times * config.retryStrategy.retryDelayBase,
                2000,
              );
              logger.warn(
                `Redis retry attempt ${times}, next retry in ${delay}ms`,
              );
              return delay;
            },
            lazyConnect: false,
            enableReadyCheck: true,
            showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
          },
        };
      },
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
