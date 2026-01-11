import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoDbModule } from './database/mongodb/mongodb.module';
import { RepositoriesModule } from './database/mongodb/repositories/repositories.module';
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
    MongoDbModule,
    RepositoriesModule,
    HealthModule,
  ],
  exports: [MongoDbModule, RepositoriesModule],
})
export class InfrastructureModule {}
