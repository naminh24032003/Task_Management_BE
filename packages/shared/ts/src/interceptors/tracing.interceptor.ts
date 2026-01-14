import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  serviceName: string;
  operationName: string;
}

/**
 * Async Local Storage for trace context propagation
 */
class TraceContextStorage {
  private static context: TraceContext | null = null;

  static set(ctx: TraceContext): void {
    TraceContextStorage.context = ctx;
  }

  static get(): TraceContext | null {
    return TraceContextStorage.context;
  }

  static clear(): void {
    TraceContextStorage.context = null;
  }
}

export { TraceContextStorage };

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly serviceName: string = 'unknown-service') {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const handler = context.getHandler();
    const className = context.getClass().name;
    const operationName = `${className}.${handler.name}`;

    // Generate or extract trace IDs
    const { traceId, parentSpanId } = this.extractTraceIds(context);
    const spanId = this.generateSpanId();

    const traceContext: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      startTime,
      serviceName: this.serviceName,
      operationName,
    };

    // Set context for downstream use
    TraceContextStorage.set(traceContext);

    return next.handle().pipe(
      tap({
        complete: () => {
          // Record span completion
          const duration = Date.now() - startTime;
          this.recordSpan(traceContext, duration, 'OK');
          TraceContextStorage.clear();
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.recordSpan(traceContext, duration, 'ERROR', error);
          TraceContextStorage.clear();
        },
      }),
    );
  }

  private extractTraceIds(context: ExecutionContext): {
    traceId: string;
    parentSpanId?: string;
  } {
    const contextType = context.getType();

    if (contextType === 'rpc') {
      const metadata = context.switchToRpc().getContext();
      const traceId = metadata?.get?.('x-trace-id')?.[0]?.toString();
      const parentSpanId = metadata?.get?.('x-span-id')?.[0]?.toString();

      return {
        traceId: traceId || this.generateTraceId(),
        parentSpanId,
      };
    }

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      const traceId = request.headers['x-trace-id'];
      const parentSpanId = request.headers['x-span-id'];

      return {
        traceId: traceId || this.generateTraceId(),
        parentSpanId,
      };
    }

    return { traceId: this.generateTraceId() };
  }

  private generateTraceId(): string {
    return `${Date.now().toString(16)}-${this.randomHex(16)}`;
  }

  private generateSpanId(): string {
    return this.randomHex(16);
  }

  private randomHex(length: number): string {
    let result = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private recordSpan(
    context: TraceContext,
    duration: number,
    status: 'OK' | 'ERROR',
    error?: Error,
  ): void {
    // This can be extended to send spans to Jaeger, Zipkin, etc.
    const span = {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      operationName: context.operationName,
      serviceName: context.serviceName,
      startTime: context.startTime,
      duration,
      status,
      error: error
        ? {
            name: error.name,
            message: error.message,
          }
        : undefined,
    };

    // In production, send to tracing backend
    if (process.env.NODE_ENV === 'development') {
      console.debug('[TRACE]', JSON.stringify(span));
    }
  }
}

/**
 * Factory function to create tracing interceptor with service name
 */
export function createTracingInterceptor(serviceName: string): TracingInterceptor {
  return new TracingInterceptor(serviceName);
}
