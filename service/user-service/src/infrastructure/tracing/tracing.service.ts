import { Injectable, Logger } from '@nestjs/common';
import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';

/**
 * TracingService provides helper methods for manual span creation
 * Use this for custom spans in business logic
 */
@Injectable()
export class TracingService {
    private readonly logger = new Logger(TracingService.name);
    private readonly tracer = trace.getTracer('user-service');

    /**
     * Create a new span for a synchronous operation
     */
    createSpan<T>(
        name: string,
        operation: (span: Span) => T,
        attributes?: Record<string, string | number | boolean>,
    ): T {
        return this.tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL }, (span) => {
            try {
                if (attributes) {
                    Object.entries(attributes).forEach(([key, value]) => {
                        span.setAttribute(key, value);
                    });
                }
                const result = operation(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Create a new span for an async operation
     */
    async createAsyncSpan<T>(
        name: string,
        operation: (span: Span) => Promise<T>,
        attributes?: Record<string, string | number | boolean>,
    ): Promise<T> {
        return this.tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL }, async (span) => {
            try {
                if (attributes) {
                    Object.entries(attributes).forEach(([key, value]) => {
                        span.setAttribute(key, value);
                    });
                }
                const result = await operation(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Add an event to the current active span
     */
    addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
        const span = trace.getActiveSpan();
        if (span) {
            span.addEvent(name, attributes);
        }
    }

    /**
     * Set attributes on the current active span
     */
    setAttributes(attributes: Record<string, string | number | boolean>): void {
        const span = trace.getActiveSpan();
        if (span) {
            Object.entries(attributes).forEach(([key, value]) => {
                span.setAttribute(key, value);
            });
        }
    }

    /**
     * Get the current trace ID for logging correlation
     */
    getCurrentTraceId(): string | undefined {
        const span = trace.getActiveSpan();
        if (span) {
            return span.spanContext().traceId;
        }
        return undefined;
    }

    /**
     * Create a span specifically for database operations
     */
    async traceDatabaseOperation<T>(
        operationName: string,
        collection: string,
        operation: () => Promise<T>,
    ): Promise<T> {
        return this.createAsyncSpan(
            `db.${collection}.${operationName}`,
            async (span) => {
                span.setAttribute('db.system', 'mongodb');
                span.setAttribute('db.collection', collection);
                span.setAttribute('db.operation', operationName);
                return operation();
            },
        );
    }

    /**
     * Create a span specifically for gRPC calls
     */
    async traceGrpcCall<T>(
        service: string,
        method: string,
        operation: () => Promise<T>,
    ): Promise<T> {
        return this.createAsyncSpan(
            `grpc.${service}/${method}`,
            async (span) => {
                span.setAttribute('rpc.system', 'grpc');
                span.setAttribute('rpc.service', service);
                span.setAttribute('rpc.method', method);
                return operation();
            },
        );
    }
}
