import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
        transport: Transport.GRPC,
        options: {
            package: 'user',
            protoPath: join(process.cwd(), '../../packages/proto/user/v1/user.proto'),
            url: 'localhost:50051',
        },
    });
    // Enable graceful shutdown
    app.enableShutdownHooks();
    await app.listen();
    console.log('User Service is listening on localhost:50051');
}
bootstrap();
