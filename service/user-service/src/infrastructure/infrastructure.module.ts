import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoDbModule } from './database/mongodb/mongodb.module';
import { RepositoriesModule } from './database/mongodb/repositories/repositories.module';
import { TypeOrmConfigModule } from './database/typeorm/typeorm.module';
import { TypeOrmRepositoriesModule } from './database/typeorm/repositories/repositories.module';
import { MultiTenancyModule } from './multi-tenancy/multi-tenancy.module';
import { HealthModule } from './health/health.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    MultiTenancyModule,
    MongoDbModule,
    RepositoriesModule,
    TypeOrmConfigModule,
    TypeOrmRepositoriesModule,
    HealthModule,
  ],
  exports: [
    MongoDbModule,
    RepositoriesModule,
    TypeOrmConfigModule,
    TypeOrmRepositoriesModule,
    MultiTenancyModule,
  ],
})
export class InfrastructureModule {}
