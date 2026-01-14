import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../logging/logger.service';

export interface GrpcMetadata {
  get(key: string): (string | Buffer)[] | undefined;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const contextType = context.getType();

    // Handle gRPC context
    if (contextType === 'rpc') {
      return this.handleRpc(context, next, startTime);
    }

    // Handle HTTP context
    if (contextType === 'http') {
      return this.handleHttp(context, next, startTime);
    }

    return next.handle();
  }

  private handleRpc(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<unknown> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const metadata = rpcContext.getContext() as GrpcMetadata;

    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;
    const fullMethod = `${className}.${methodName}`;

    // Extract tenant and user from metadata
    const tenantId = metadata?.get?.('x-tenant-id')?.[0]?.toString();
    const userId = metadata?.get?.('x-user-id')?.[0]?.toString();
    const traceId = metadata?.get?.('x-trace-id')?.[0]?.toString() || this.generateTraceId();

    this.logger.info(`[gRPC] --> ${fullMethod}`, {
      traceId,
      tenantId,
      userId,
      method: fullMethod,
      metadata: this.sanitizeData(data),
    });

    return next.handle().pipe(
      tap((response) => {
        this.logger.logGrpcResponse(fullMethod, startTime, true, {
          traceId,
          tenantId,
          userId,
        });
      }),
      catchError((error) => {
        this.logger.error(`[gRPC] <-- ${fullMethod} FAILED`, error, {
          traceId,
          tenantId,
          userId,
          method: fullMethod,
        });
        this.logger.logGrpcResponse(fullMethod, startTime, false, {
          traceId,
          tenantId,
          userId,
        });
        return throwError(() => error);
      }),
    );
  }

  private handleHttp(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;

    const tenantId = headers['x-tenant-id'];
    const userId = headers['x-user-id'];
    const traceId = headers['x-trace-id'] || this.generateTraceId();

    this.logger.info(`[HTTP] --> ${method} ${url}`, {
      traceId,
      tenantId,
      userId,
      method: `${method} ${url}`,
      metadata: this.sanitizeData(body),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.info(`[HTTP] <-- ${method} ${url} - ${duration}ms`, {
          traceId,
          tenantId,
          userId,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`[HTTP] <-- ${method} ${url} FAILED - ${duration}ms`, error, {
          traceId,
          tenantId,
          userId,
        });
        return throwError(() => error);
      }),
    );
  }

  private generateTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Remove sensitive fields from logged data
   */
  private sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'passwordHash', 'passwordSalt', 'token', 'accessToken', 'refreshToken', 'secret'];
    const sanitized = { ...data } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
