import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { SharedModule } from '@task-management/shared';
import { UserController } from './ports/inbound/user.controller';
import { AuthController } from './ports/inbound/auth.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { ApplicationModule } from './application/application.module';

@Module({
  imports: [
    // Shared module with logging, tracing, and error handling
    SharedModule.forRoot({
      serviceName: 'user-service',
      enableLogging: true,
      enableTracing: true,
      enableTimeout: true,
      enableExceptionFilter: true,
      timeoutMs: 30000,
    }),
    InfrastructureModule,
    ApplicationModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [AuthController, UserController],
  providers: [],
})
export class AppModule {}
