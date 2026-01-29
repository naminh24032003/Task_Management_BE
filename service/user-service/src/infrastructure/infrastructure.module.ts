import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoDbModule } from './database/mongodb/mongodb.module';
import { RepositoriesModule } from './database/mongodb/repositories/repositories.module';
import { TypeOrmConfigModule } from './database/typeorm/typeorm.module';
import { TypeOrmRepositoriesModule } from './database/typeorm/repositories/repositories.module';
import { MultiTenancyModule } from './multi-tenancy/multi-tenancy.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AuthCacheModule } from './cache/auth-cache.module';
import { KafkaModule } from './kafka/kafka.module';
import { TracingModule } from './tracing/tracing.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import oauthConfig from './config/oauth.config';
import kafkaConfig from './config/kafka.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig, redisConfig, oauthConfig, kafkaConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    MultiTenancyModule,
    MongoDbModule,
    RepositoriesModule,
    TypeOrmConfigModule,
    TypeOrmRepositoriesModule,
    RedisModule,
    AuthCacheModule,  // Auth caching for tokens, sessions, permissions
    KafkaModule,
    TracingModule,
    HealthModule,
  ],
  exports: [
    MongoDbModule,
    RepositoriesModule,
    TypeOrmConfigModule,
    TypeOrmRepositoriesModule,
    MultiTenancyModule,
    RedisModule,
    AuthCacheModule,
    KafkaModule,
  ],
})
export class InfrastructureModule { }
