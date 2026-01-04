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
        package: 'user',
        protoPath,
        url: grpcUrl,
        loader: {
          includeDirs: [join(__dirname, '../proto')],
        },
      },
    },
  );

  await app.listen();
  console.log(`🚀 User Service gRPC running at ${grpcUrl}`);
  console.log(`📄 Using proto: ${protoPath}`);
}

bootstrap();
