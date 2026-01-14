import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { LoggerService } from '../logging/logger.service';

/**
 * Standard gRPC error codes
 */
export enum GrpcStatus {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16,
}

export interface GrpcError {
  code: GrpcStatus;
  message: string;
  details?: unknown;
}

/**
 * Map common error codes to gRPC status
 */
const errorCodeToGrpcStatus: Record<string, GrpcStatus> = {
  NOT_FOUND: GrpcStatus.NOT_FOUND,
  INVALID_ARGUMENT: GrpcStatus.INVALID_ARGUMENT,
  ALREADY_EXISTS: GrpcStatus.ALREADY_EXISTS,
  PERMISSION_DENIED: GrpcStatus.PERMISSION_DENIED,
  UNAUTHENTICATED: GrpcStatus.UNAUTHENTICATED,
  UNAUTHORIZED: GrpcStatus.UNAUTHENTICATED,
  INTERNAL_ERROR: GrpcStatus.INTERNAL,
  VALIDATION_ERROR: GrpcStatus.INVALID_ARGUMENT,
  CONFLICT: GrpcStatus.ALREADY_EXISTS,
  FORBIDDEN: GrpcStatus.PERMISSION_DENIED,
};

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  private logger: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger || new LoggerService();
    this.logger.setContext('GrpcExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    const error = this.transformException(exception);

    // Log the error
    this.logger.error(`gRPC Error: ${error.message}`, exception as Error, {
      code: GrpcStatus[error.code],
    });

    return throwError(() => ({
      code: error.code,
      message: error.message,
      details: error.details,
    }));
  }

  private transformException(exception: unknown): GrpcError {
    // Handle RpcException
    if (exception instanceof RpcException) {
      const error = exception.getError();

      if (typeof error === 'object' && error !== null) {
        const errorObj = error as { code?: string | number; message?: string; details?: unknown };
        return {
          code: this.resolveGrpcStatus(errorObj.code),
          message: errorObj.message || 'An error occurred',
          details: errorObj.details,
        };
      }

      return {
        code: GrpcStatus.INTERNAL,
        message: typeof error === 'string' ? error : 'An error occurred',
      };
    }

    // Handle standard Error
    if (exception instanceof Error) {
      const errorWithCode = exception as Error & { code?: string };
      return {
        code: this.resolveGrpcStatus(errorWithCode.code),
        message: exception.message,
        details: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Handle unknown errors
    return {
      code: GrpcStatus.UNKNOWN,
      message: 'An unknown error occurred',
    };
  }

  private resolveGrpcStatus(code?: string | number): GrpcStatus {
    if (typeof code === 'number') {
      return code in GrpcStatus ? code : GrpcStatus.INTERNAL;
    }

    if (typeof code === 'string') {
      return errorCodeToGrpcStatus[code.toUpperCase()] || GrpcStatus.INTERNAL;
    }

    return GrpcStatus.INTERNAL;
  }
}

/**
 * Factory function to create exception filter with logger
 */
export function createGrpcExceptionFilter(logger?: LoggerService): GrpcExceptionFilter {
  return new GrpcExceptionFilter(logger);
}
