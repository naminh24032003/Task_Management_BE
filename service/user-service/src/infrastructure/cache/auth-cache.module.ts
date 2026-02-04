import { Module, Global, forwardRef } from '@nestjs/common';
import { MultiTierCacheService } from './multi-tier-cache.service';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { AUTH_CACHE_SERVICE } from '../../application/ports/auth-cache.port';
import { cacheMetricsProviders } from './cache-metrics';


@Global()
@Module({
  imports: [
    RedisModule,
    forwardRef(() => KafkaModule),
  ],
  providers: [
    MultiTierCacheService,
    {
      provide: AUTH_CACHE_SERVICE,
      useExisting: MultiTierCacheService,
    },
    ...cacheMetricsProviders,
  ],
  exports: [MultiTierCacheService, AUTH_CACHE_SERVICE],
})
export class AuthCacheModule { }
