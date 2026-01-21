import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { join } from 'path';
import { Request, Response } from 'express';

import { AuthModule } from './infrastructure/auth/auth.module';
import { GrpcModule } from './infrastructure/grpc/grpc.module';
import { HealthModule } from './presentation/health/health.module';
import { RateLimitingModule } from './infrastructure/rate-limiting/rate-limiting.module';
import { GraphqlResolversModule } from './presentation/graphql/graphql.module';
import { ApplicationModule } from './application/application.module';

import {
  appConfig,
  graphqlConfig,
  grpcConfig,
  redisConfig,
  authConfig,
} from './infrastructure/config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, graphqlConfig, grpcConfig, redisConfig, authConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // GraphQL with Apollo Server
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const playground = configService.get<boolean>('graphql.playground', false);
        const introspection = configService.get<boolean>('graphql.introspection', false);
        const debug = configService.get<boolean>('graphql.debug', false);

        return {
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: false, // Disable built-in playground, use Apollo Studio
          introspection: introspection || playground,
          debug,
          context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
          plugins: playground
            ? [ApolloServerPluginLandingPageLocalDefault({ embed: true })]
            : [],
          formatError: (error) => {
            // Don't expose internal errors in production
            if (!debug && error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
              return {
                message: 'Internal server error',
                extensions: {
                  code: error.extensions.code,
                },
              };
            }
            return error;
          },
        };
      },
    }),

    // Feature modules
    AuthModule,
    GrpcModule,
    ApplicationModule,
    GraphqlResolversModule,
    HealthModule,
    RateLimitingModule,
  ],
})
export class AppModule { }
