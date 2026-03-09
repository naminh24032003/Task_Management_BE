import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
  path?: string;
}

/**
 * HttpExceptionFilter
 *
 * Global HTTP exception filter that:
 *   1. Catches ALL unhandled exceptions that survive to the response layer
 *      (both HttpException sub-classes and unknown JS errors).
 *   2. Returns a consistent JSON envelope — never leaks stack traces in prod.
 *   3. Preserves the correct HTTP status code.
 *   4. Includes the `x-request-id` in the response body for client-side
 *      correlation (same ID echoed in the response header by middleware).
 *   5. Logs every 5xx error with full details (for monitoring / alerting).
 *
 * Register via APP_FILTER in AppModule so Reflector DI is available.
 *
 * @example
 * // app.module.ts
 * providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }]
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    // GraphQL context — Apollo handles its own error formatting via formatError.
    // We only intercept the raw HTTP layer here.
    if (host.getType<GqlContextType>() === 'graphql') {
      // Let Apollo's formatError handle it — just re-throw
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.buildErrorResponse(exception, request);

    // Log 5xx errors with full detail; 4xx are expected client errors
    if (status >= 500) {
      this.logger.error(
        `[${body.requestId ?? 'no-id'}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${body.requestId ?? 'no-id'}] ${request.method} ${request.url} → ${status}: ${body.message}`,
      );
    }

    response.status(status).json(body);
  }

  // ── Error shape builder ──────────────────────────────────────────────────

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): { status: number; body: ErrorBody } {
    const requestId = request.headers['x-request-id'] as string | undefined;
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      // NestJS ValidationPipe returns { message: string[], error: string, statusCode: number }
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        return {
          status,
          body: {
            statusCode: status,
            error: (r.error as string) ?? HttpStatus[status] ?? 'Error',
            message: (r.message as string | string[]) ?? exception.message,
            requestId,
            timestamp,
            path: request.url,
          },
        };
      }

      return {
        status,
        body: {
          statusCode: status,
          error: HttpStatus[status] ?? 'Error',
          message: typeof res === 'string' ? res : exception.message,
          requestId,
          timestamp,
          path: request.url,
        },
      };
    }

    // Unknown / unhandled error — never expose internals in production
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      status,
      body: {
        statusCode: status,
        error: 'Internal Server Error',
        message: this.isProduction
          ? 'An unexpected error occurred. Please try again later.'
          : exception instanceof Error
            ? exception.message
            : String(exception),
        requestId,
        timestamp,
        path: request.url,
      },
    };
  }
}
