import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { UserGrpcClient } from './clients/user.client';
import { TaskGrpcClient } from './clients/task.client';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['user.v1'],
            protoPath: [
              join(process.cwd(), 'proto/user/v1/user.proto'),
            ],
            url: configService.get<string>('grpc.userService.url'),
            loader: {
              includeDirs: [join(process.cwd(), 'proto')],
            },
          },
        }),
      },
      {
        name: 'TASK_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['task.v1'],
            protoPath: [
              join(process.cwd(), 'proto/task/v1/task.proto'),
            ],
            url: configService.get<string>('grpc.taskService.url'),
            loader: {
              includeDirs: [join(process.cwd(), 'proto')],
            },
          },
        }),
      },
    ]),
  ],
  providers: [UserGrpcClient, TaskGrpcClient],
  exports: [UserGrpcClient, TaskGrpcClient],
})
export class GrpcModule { }
