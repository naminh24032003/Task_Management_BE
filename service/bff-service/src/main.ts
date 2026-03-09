import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as express from 'express';
import * as compression from 'compression';
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';
import { AppModule } from './app.module';
import { RedisSubscriberService } from './infrastructure/redis/redis-subscriber.service';

// ── Body size constants ───────────────────────────────────────────────────────
// GraphQL queries are JSON — 256 KB is generous for any legitimate operation.
// Larger payloads are almost certainly an attack or a client bug.
const BODY_LIMIT = '256kb';

// ── Path normalizer for Prometheus labels ─────────────────────────────────────
// Replace dynamic segments (UUIDs, Mongo ObjectIDs, numeric IDs) with :id
// to keep Prometheus time-series cardinality bounded.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const OBJECTID_RE = /[0-9a-f]{24}/gi;
const NUMERIC_ID_RE = /\/\d+(?=\/|$)/g;

function normalizePath(raw: string): string {
  // Known static paths — fast short-circuit
  if (raw === '/graphql' || raw === '/health' || raw === '/healthz' || raw === '/ready') {
    return raw;
  }
  return raw
    .replace(UUID_RE, ':id')
    .replace(OBJECTID_RE, ':id')
    .replace(NUMERIC_ID_RE, '/:id');
}

// ── Process-level error guards ─────────────────────────────────────────────────
// Catch any Promise rejection not attached to a .catch() handler.
// Without this, Node ≥ 15 exits with code 1; ≤ 14 silently swallows the error.
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const logger = new Logger('UnhandledRejection');
  logger.error(`Unhandled promise rejection at: ${String(promise)}`, String(reason));
  // Do NOT process.exit() here — let K8s liveness probe detect degradation.
  // The app stays up so in-flight requests finish; the pod will be restarted
  // if the rejection indicates a broken state (e.g. DB connection lost).
});

// Catch synchronous throw escaping all try/catch.
process.on('uncaughtException', (error: Error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught exception — process will exit after flush', error.stack);
  // Give existing transports (Winston/pino) 500 ms to flush before hard exit.
  setTimeout(() => process.exit(1), 500).unref();
});

// Create Prometheus registry
const register = new Registry();

// Collect default metrics
collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'bff_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'bff_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const graphqlOperationsTotal = new Counter({
  name: 'bff_graphql_operations_total',
  help: 'Total number of GraphQL operations',
  labelNames: ['operation_type', 'operation_name'],
  registers: [register],
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ── Response compression ──────────────────────────────────────────────────
  // Compresses responses ≥ 1KB with gzip (brotli available via Accept-Encoding).
  // Must be registered BEFORE body parsers so the response stream is wrapped early.
  // Exclude already-compressed types: images, video, gzip, br.
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      // Don't compress multipart (file uploads) — already binary
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/')) return false;
      return compression.filter(req, res);
    },
    threshold: 1024,   // only compress responses ≥ 1 KB
    level: 6,          // zlib compression level (1=fast, 9=small); 6 is the sweet spot
  }));

  // ── Explicit body-size limits ──────────────────────────────────────────────
  // NestJS/Express does NOT set a body limit by default for urlencoded bodies,
  // and its default for json() is 100 KB — too small for some payloads but
  // also implicitly unbounded for custom parsers. Hardening both.
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
  // Raw buffer body (e.g. webhook signature verification)
  app.use(express.raw({ type: 'application/octet-stream', limit: BODY_LIMIT }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const corsOrigins = configService.get<string[]>('app.corsOrigins', ['http://localhost:3000']);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // ── Enterprise Security & Cache-Control Headers ───────────────────────────
  // Applied at Express middleware level so ALL routes (including GraphQL POST)
  // receive the baseline headers before NestJS interceptors run.
  app.use((_req: any, res: any, next: any) => {
    // Cache directives — never store API / GraphQL responses
    res.setHeader('Cache-Control', 'no-store');            // No storage anywhere
    res.setHeader('Pragma', 'no-cache');                   // HTTP/1.0 backward compat
    res.setHeader('Surrogate-Control', 'no-store');        // CDN: Fastly/Varnish/CloudFront
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');    // Prevent MIME sniffing
    res.setHeader('X-Frame-Options', 'DENY');              // Block clickjacking
    res.setHeader('X-XSS-Protection', '0');                // Disable legacy XSS filter
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    // ── Content-Security-Policy ───────────────────────────────────────────────
    // This is a pure JSON API — it should never load scripts, images or frames.
    // The strictest possible CSP for API-only responses:
    //   default-src 'none'   → block all content loading (no HTML rendered)
    //   frame-ancestors 'none' → block embedding in <iframe> / <frame>
    //   base-uri 'none'      → block <base> tag injection
    //   form-action 'none'   → block <form> submission re-targeting
    res.setHeader('Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    // HSTS — only when behind HTTPS termination (Kong / Nginx / ALB)
    if (_req.headers?.['x-forwarded-proto'] === 'https' || (_req as any).secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
  });

  // Request logging and metrics middleware
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const method = req.method;
      const status = res.statusCode;

      // ── Normalize path for Prometheus labels ──────────────────────────
      // Raw req.path may contain UUIDs, IDs, etc. which creates unbounded
      // cardinality in Prometheus → OOM. Map to a fixed set of known routes.
      const rawPath = req.path || req.url;
      const path = normalizePath(rawPath);

      httpRequestsTotal.inc({ method, path, status });
      httpRequestDuration.observe({ method, path, status }, duration);

      // Track GraphQL operations
      if (rawPath === '/graphql' && req.body?.operationName) {
        graphqlOperationsTotal.inc({
          operation_type: req.body.query?.trim().startsWith('mutation') ? 'mutation' : 'query',
          operation_name: req.body.operationName,
        });
      }
    });

    next();
  });

  // Metrics endpoint on separate port
  const metricsPort = configService.get<number>('app.metricsPort', 9092);
  const metricsServer = http.createServer(async (req, res) => {
    // Security + cache-control on every response from the internal server
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else if (req.url === '/health' || req.url === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else if (req.url === '/ready') {
      // Readiness check — returns 503 if Redis is down so K8s stops routing traffic
      const redisSubscriber = app.get(RedisSubscriberService);
      const redisUp = redisSubscriber.isHealthy;
      const status = redisUp ? 'ok' : 'degraded';
      res.statusCode = redisUp ? 200 : 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status,
        checks: {
          redis: redisUp ? 'connected' : 'disconnected',
        },
      }));
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  metricsServer.listen(metricsPort, '0.0.0.0', () => {
    logger.log(`Metrics server running at http://0.0.0.0:${metricsPort}`);
    logger.log(`  - Metrics: http://0.0.0.0:${metricsPort}/metrics`);
    logger.log(`  - Health:  http://0.0.0.0:${metricsPort}/health`);
  });

  // Enable NestJS shutdown lifecycle hooks (calls beforeApplicationShutdown / onApplicationShutdown)
  app.enableShutdownHooks();

  // Main application
  const port = configService.get<number>('app.port', 4000);
  await app.listen(port, '0.0.0.0');

  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  logger.log(`BFF GraphQL Gateway running in ${nodeEnv} mode`);
  logger.log(`  - GraphQL:    http://0.0.0.0:${port}/graphql`);
  logger.log(`  - WebSocket:  ws://0.0.0.0:${port}/notifications`);

  const playground = configService.get<boolean>('graphql.playground', false);
  if (playground) {
    logger.log(`  - Apollo Studio: http://0.0.0.0:${port}/graphql`);
  }

  // Graceful shutdown — K8s sends SIGTERM when terminating a pod
  // Flow: SIGTERM → stop accepting new requests → finish in-flight → close servers → exit
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received — starting graceful shutdown`);
    // 1. Stop the raw metrics/health HTTP server
    metricsServer.close(() => logger.log('Metrics server closed'));
    // 2. Close NestJS app (closes HTTP server + all connections)
    await app.close();
    logger.log('Application closed cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
