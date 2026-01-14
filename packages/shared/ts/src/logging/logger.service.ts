import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  service?: string;
  method?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;
  private static globalContext: LogContext = {};

  constructor() {}

  static setGlobalContext(context: LogContext): void {
    LoggerService.globalContext = { ...LoggerService.globalContext, ...context };
  }

  setContext(context: string): void {
    this.context = context;
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...LoggerService.globalContext,
        ...context,
        service: this.context || context?.service,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (duration !== undefined) {
      entry.duration = duration;
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(json);
        break;
      case LogLevel.WARN:
        console.warn(json);
        break;
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
        console.debug(json);
        break;
      default:
        console.log(json);
    }
  }

  log(message: string, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { service: context } : context;
    this.output(this.formatLog(LogLevel.INFO, message, ctx));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog(LogLevel.INFO, message, context));
  }

  error(message: string, trace?: string | Error, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { service: context } : context;
    const error = trace instanceof Error ? trace : trace ? new Error(trace) : undefined;
    this.output(this.formatLog(LogLevel.ERROR, message, ctx, error));
  }

  warn(message: string, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { service: context } : context;
    this.output(this.formatLog(LogLevel.WARN, message, ctx));
  }

  debug(message: string, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { service: context } : context;
    this.output(this.formatLog(LogLevel.DEBUG, message, ctx));
  }

  verbose(message: string, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { service: context } : context;
    this.output(this.formatLog(LogLevel.VERBOSE, message, ctx));
  }

  /**
   * Log with duration measurement
   */
  logWithDuration(
    message: string,
    startTime: number,
    context?: LogContext,
    level: LogLevel = LogLevel.INFO,
  ): void {
    const duration = Date.now() - startTime;
    this.output(this.formatLog(level, message, context, undefined, duration));
  }

  /**
   * Log gRPC request
   */
  logGrpcRequest(
    method: string,
    tenantId?: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.info(`gRPC Request: ${method}`, {
      method,
      tenantId,
      userId,
      metadata,
    });
  }

  /**
   * Log gRPC response
   */
  logGrpcResponse(
    method: string,
    startTime: number,
    success: boolean,
    context?: LogContext,
  ): void {
    const duration = Date.now() - startTime;
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.output(
      this.formatLog(
        level,
        `gRPC Response: ${method} - ${success ? 'SUCCESS' : 'FAILED'}`,
        { ...context, method },
        undefined,
        duration,
      ),
    );
  }
}
