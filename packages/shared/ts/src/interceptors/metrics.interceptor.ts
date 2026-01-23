import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Interceptor that automatically records metrics for all gRPC and HTTP operations.
 * This provides latency histograms at the gRPC/HTTP layer level.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(
        private readonly metricsService: MetricsService,
        private readonly serviceName: string,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const startTime = Date.now();
        const handler = context.getHandler();
        const className = context.getClass().name;
        const operationName = `${className}.${handler.name}`;
        const contextType = context.getType();

        // Determine layer based on context type
        const layer = contextType === 'rpc' ? 'grpc' : 'grpc';

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                this.metricsService.recordDuration(
                    {
                        service: this.serviceName,
                        operation: operationName,
                        status: 'success',
                        layer,
                    },
                    duration,
                );
            }),
            catchError((error) => {
                const duration = Date.now() - startTime;
                this.metricsService.recordDuration(
                    {
                        service: this.serviceName,
                        operation: operationName,
                        status: 'error',
                        layer,
                    },
                    duration,
                );
                this.metricsService.recordError(
                    this.serviceName,
                    operationName,
                    error.name || 'UnknownError',
                    layer,
                );
                return throwError(() => error);
            }),
        );
    }
}

export function createMetricsInterceptor(
    metricsService: MetricsService,
    serviceName: string,
): MetricsInterceptor {
    return new MetricsInterceptor(metricsService, serviceName);
}
