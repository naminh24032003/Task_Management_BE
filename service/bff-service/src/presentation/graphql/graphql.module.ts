import { Module } from '@nestjs/common';
import { GrpcModule } from '../../infrastructure/grpc/grpc.module';
import { AuthModule } from '../../infrastructure/auth/auth.module';
import { ApplicationModule } from '../../application/application.module';
import { UserResolver } from './resolvers/user.resolver';
import { TaskResolver } from './resolvers/task.resolver';

@Module({
  imports: [GrpcModule, AuthModule, ApplicationModule],
  providers: [UserResolver, TaskResolver],
})
export class GraphqlResolversModule { }
