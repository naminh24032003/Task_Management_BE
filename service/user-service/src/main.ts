  import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  /**
   * Proto Resolution Strategy:
   * ─────────────────────────────────────────────────────────────
   * Source of truth: packages/proto/user/v1/user.proto
   * Runtime artifact: service/user-service/proto/user/v1/user.proto
   * 
   * Local dev: `npm run proto:sync` copies proto to ./proto
   * Docker:    Dockerfile COPY packages/proto/user/v1 ./proto/user/v1
   * 
   * Result: Both environments use same relative path from dist/
   * ─────────────────────────────────────────────────────────────
   */
  const protoPath = join(__dirname, '../proto/user/v1/user.proto');
  const url = process.env.GRPC_URL || '0.0.0.0:50051';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'user',
        protoPath,
        url,
      },
    },
  );

  await app.listen();
  console.log(`🚀 User Service gRPC running at ${url}`);
  console.log(`📄 Using proto: ${protoPath}`);
}

bootstrap();
