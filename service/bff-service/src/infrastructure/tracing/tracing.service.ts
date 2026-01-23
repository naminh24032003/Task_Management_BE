import { Injectable, Logger } from '@nestjs/common';
import { trace, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';

/**
 * TracingService for BFF Service
 */
@Injectable()
export class TracingService {
    private readonly logger = new Logger(TracingService.name);
    private readonly tracer = trace.getTracer('bff-service');

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
}
