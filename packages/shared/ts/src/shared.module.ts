import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logging/logger.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TracingInterceptor } from './interceptors/tracing.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';
import { MetricsService } from './metrics/metrics.service';

export interface SharedModuleOptions {
  serviceName: string;
  enableLogging?: boolean;
  enableTracing?: boolean;
  enableTimeout?: boolean;
  enableMetrics?: boolean;
  enableExceptionFilter?: boolean;
  timeoutMs?: number;
}

@Global()
@Module({})
export class SharedModule {
  static forRoot(options: SharedModuleOptions): DynamicModule {
    const {
      serviceName,
      enableLogging = true,
      enableTracing = true,
      enableTimeout = true,
      enableMetrics = true,
      enableExceptionFilter = true,
      timeoutMs = 30000,
    } = options;

    const providers: Provider[] = [
      LoggerService,
      MetricsService,
      {
        provide: 'SERVICE_NAME',
        useValue: serviceName,
      },
    ];

    // Add metrics interceptor (should be first to capture total duration)
    if (enableMetrics) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: (metricsService: MetricsService) =>
          new MetricsInterceptor(metricsService, serviceName),
        inject: [MetricsService],
      });
    }

    // Add logging interceptor
    if (enableLogging) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: LoggingInterceptor,
      });
    }

    // Add tracing interceptor
    if (enableTracing) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: () => new TracingInterceptor(serviceName),
      });
    }

    // Add timeout interceptor
    if (enableTimeout) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: () => new TimeoutInterceptor(timeoutMs),
      });
    }

    // Add exception filter
    if (enableExceptionFilter) {
      providers.push({
        provide: APP_FILTER,
        useFactory: (logger: LoggerService) => new GrpcExceptionFilter(logger),
        inject: [LoggerService],
      });
    }

    return {
      module: SharedModule,
      providers,
      exports: [LoggerService, MetricsService, 'SERVICE_NAME'],
    };
  }

  /**
   * For feature modules that only need the logger
   */
  static forFeature(): DynamicModule {
    return {
      module: SharedModule,
      providers: [LoggerService, MetricsService],
      exports: [LoggerService, MetricsService],
    };
  }
}
