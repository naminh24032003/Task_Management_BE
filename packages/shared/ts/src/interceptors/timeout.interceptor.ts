import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 30000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${this.timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

/**
 * Factory function to create timeout interceptor with custom timeout
 */
export function createTimeoutInterceptor(timeoutMs: number): TimeoutInterceptor {
  return new TimeoutInterceptor(timeoutMs);
}
