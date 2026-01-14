import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseWrapper<T> {
  data: T;
  metadata?: {
    timestamp: string;
    traceId?: string;
  };
}

/**
 * Transform response to standard format (for HTTP endpoints)
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseWrapper<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseWrapper<T>> {
    // Only apply to HTTP context
    if (context.getType() !== 'http') {
      return next.handle() as Observable<ResponseWrapper<T>>;
    }

    const request = context.switchToHttp().getRequest();
    const traceId = request.headers['x-trace-id'];

    return next.handle().pipe(
      map((data) => ({
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          traceId,
        },
      })),
    );
  }
}
