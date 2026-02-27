import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';
import * as http from 'http';
import { register } from 'prom-client';

async function bootstrap() {

  const protoPath = join(__dirname, '../proto/user/v1/user.proto');
  const grpcUrl = process.env.GRPC_URL || '0.0.0.0:50051';
  const metricsPort = parseInt(process.env.METRICS_PORT || '9090');

  // Start simple HTTP server for metrics
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  metricsServer.listen(metricsPort, () => {
    console.log(`📊 Metrics endpoint running at http://0.0.0.0:${metricsPort}/metrics`);
  });

  // Create gRPC microservice
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'user.v1',
        protoPath,
        url: grpcUrl,
        loader: {
          includeDirs: [join(__dirname, '../proto')],
        },
      },
    },
  );

  // Enable NestJS shutdown lifecycle hooks
  app.enableShutdownHooks();

  await app.listen();
  console.log(`🚀 User Service gRPC running at ${grpcUrl}`);
  console.log(`📄 Using proto: ${protoPath}`);

  // Graceful shutdown — K8s sends SIGTERM when terminating a pod
  // Flow: SIGTERM → drain gRPC connections → close metrics server → exit
  const shutdown = async (signal: string) => {
    console.log(`${signal} received — starting graceful shutdown`);
    // 1. Stop the metrics HTTP server
    metricsServer.close(() => console.log('Metrics server closed'));
    // 2. Close NestJS microservice (drains gRPC connections)
    await app.close();
    console.log('Application closed cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
