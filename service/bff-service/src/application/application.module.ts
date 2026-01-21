import { Module } from '@nestjs/common';
import { GrpcModule } from '../infrastructure/grpc/grpc.module';
import { RegisterUseCase } from './user/register.usecase';
import { LoginUseCase } from './user/login.usecase';

@Module({
    imports: [GrpcModule],
    providers: [RegisterUseCase, LoginUseCase],
    exports: [RegisterUseCase, LoginUseCase],
})
export class ApplicationModule { }
