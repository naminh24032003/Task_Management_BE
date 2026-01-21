import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';
import { AppModule } from './app.module';

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

  // Request logging and metrics middleware
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const path = req.path || req.url;
      const method = req.method;
      const status = res.statusCode;

      httpRequestsTotal.inc({ method, path, status });
      httpRequestDuration.observe({ method, path, status }, duration);

      // Track GraphQL operations
      if (path === '/graphql' && req.body?.operationName) {
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
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else if (req.url === '/health' || req.url === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else if (req.url === '/ready') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
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

  // Main application
  const port = configService.get<number>('app.port', 4000);
  await app.listen(port, '0.0.0.0');

  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  logger.log(`BFF GraphQL Gateway running in ${nodeEnv} mode`);
  logger.log(`  - GraphQL: http://0.0.0.0:${port}/graphql`);

  const playground = configService.get<boolean>('graphql.playground', false);
  if (playground) {
    logger.log(`  - Apollo Studio: http://0.0.0.0:${port}/graphql`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
