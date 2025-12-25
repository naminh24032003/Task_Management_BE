import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
    const protoPath = process.env.PROTO_PATH || join(process.cwd(), '../../packages/proto/user/v1/user.proto');
    const url = process.env.GRPC_URL || '0.0.0.0:50051';

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.GRPC,
            options: {
                package: 'user',
                protoPath: protoPath,
                url: url,
            },
        },
    );

    await app.listen();
    console.log(`🚀 User Service gRPC is running on ${url}`);
    console.log(`📄 Proto file: ${protoPath}`);
}

bootstrap();
