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

        logger.log(`Connecting to Redis Cluster at ${config.host}:${config.port}`);

        return {
          type: 'cluster',
          nodes: [{ host: config.host, port: config.port }],
          options: {
            redisOptions: {
              password: config.password || undefined,
              keyPrefix: config.keyPrefix,
              connectTimeout: config.connectTimeout,
              commandTimeout: config.commandTimeout,
              maxRetriesPerRequest: config.maxRetriesPerRequest,
              showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
            },
            enableReadyCheck: true,
            scaleReads: 'slave',
            clusterRetryStrategy: (times: number) => {
              if (
                times * config.retryStrategy.retryDelayBase >
                config.retryStrategy.maxRetryTime
              ) {
                logger.error(
                  `Redis Cluster connection failed after ${times} retries`,
                );
                return null;
              }
              const delay = Math.min(
                times * config.retryStrategy.retryDelayBase,
                2000,
              );
              logger.warn(
                `Redis Cluster retry attempt ${times}, next retry in ${delay}ms`,
              );
              return delay;
            },
          },
        };
      },
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
