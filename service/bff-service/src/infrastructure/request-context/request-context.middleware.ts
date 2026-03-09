import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestContextService } from './request-context.service';

/** Header name — lowercase for Express header access (case-insensitive) */
const HEADER = 'x-request-id';

/**
 * RequestContextMiddleware
 *
 * Runs at Express level (before NestJS pipe/guard/interceptor chain).
 *
 * Responsibilities:
 *   1. Read `x-request-id` from the incoming request header.
 *   2. Generate a UUID if the header is absent or empty.
 *   3. Validate format: if the value is longer than 128 chars (injection risk)
 *      discard it and generate a fresh UUID.
 *   4. Store the ID in the AsyncLocalStorage-backed RequestContextService.
 *   5. Echo the final ID back in the response header so clients can
 *      correlate logs end-to-end.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const raw = req.headers[HEADER];
    const incoming = Array.isArray(raw) ? raw[0] : (raw ?? '');

    // Sanitise: accept only printable ASCII, max 128 chars
    const requestId =
      incoming &&
      incoming.length <= 128 &&
      /^[\x20-\x7E]+$/.test(incoming)
        ? incoming
        : randomUUID();

    // Echo the resolved ID in the response header
    res.setHeader(HEADER, requestId);

    // Run the rest of the request lifecycle inside the async context
    this.contextService.run(
      {
        requestId,
        startedAt: new Date().toISOString(),
      },
      () => next(),
    );
  }
}
