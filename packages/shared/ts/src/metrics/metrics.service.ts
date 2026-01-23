import { Injectable } from '@nestjs/common';

export interface OperationLabels {
    service: string;
    operation: string;
    status: 'success' | 'error';
    layer: 'grpc' | 'handler' | 'repository' | 'database' | 'external' | 'total';
}

export interface MetricsRecord {
    labels: OperationLabels;
    durationMs: number;
    timestamp: Date;
}

/**
 * Abstract metrics service for tracking latency and request counts across all service layers.
 * This enables end-to-end latency visualization in Grafana:
 * Kong → BFF → gRPC → Handler → Repository → Database
 * 
 * Each service should extend this with their own Prometheus integration.
 */
@Injectable()
export class MetricsService {
    private readonly records: MetricsRecord[] = [];

    /**
     * Record the duration of an operation
     */
    recordDuration(labels: OperationLabels, durationMs: number): void {
        // Log metrics for Loki extraction (structured logging)
        console.log(JSON.stringify({
            type: 'metric',
            metric: 'service_operation_duration',
            ...labels,
            durationMs,
            durationSeconds: durationMs / 1000,
            timestamp: new Date().toISOString(),
        }));

        this.records.push({
            labels,
            durationMs,
            timestamp: new Date(),
        });

        // Keep only last 1000 records in memory
        if (this.records.length > 1000) {
            this.records.shift();
        }
    }

    /**
     * Record an error
     */
    recordError(service: string, operation: string, errorType: string, layer: OperationLabels['layer']): void {
        console.log(JSON.stringify({
            type: 'metric',
            metric: 'service_operation_error',
            service,
            operation,
            error_type: errorType,
            layer,
            timestamp: new Date().toISOString(),
        }));
    }

    /**
     * Start timing an operation - returns a function to call when done
     */
    startTimer(service: string, operation: string, layer: OperationLabels['layer']): (status?: 'success' | 'error') => void {
        const startTime = Date.now();

        return (status: 'success' | 'error' = 'success') => {
            const duration = Date.now() - startTime;
            this.recordDuration({ service, operation, status, layer }, duration);
        };
    }

    /**
     * Time an async operation and record metrics automatically
     */
    async timeOperation<T>(
        service: string,
        operation: string,
        layer: OperationLabels['layer'],
        fn: () => Promise<T>,
    ): Promise<T> {
        const startTime = Date.now();

        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            this.recordDuration({ service, operation, status: 'success', layer }, duration);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordDuration({ service, operation, status: 'error', layer }, duration);
            this.recordError(service, operation, (error as Error).name || 'Unknown', layer);
            throw error;
        }
    }

    /**
     * Get recent records (for testing/debugging)
     */
    getRecentRecords(count: number = 100): MetricsRecord[] {
        return this.records.slice(-count);
    }
}

/**
 * Decorator for timing methods automatically
 */
export function Timed(service: string, operation: string, layer: OperationLabels['layer']) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const metricsService = (this as any).metricsService as MetricsService;

            if (!metricsService) {
                return originalMethod.apply(this, args);
            }

            return metricsService.timeOperation(service, operation, layer, () =>
                originalMethod.apply(this, args)
            );
        };

        return descriptor;
    };
}
