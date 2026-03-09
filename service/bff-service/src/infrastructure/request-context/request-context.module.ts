import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * RequestContextModule
 *
 * Global module — import once in AppModule.
 * The middleware is applied to ALL routes.
 */
@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware],
  exports: [RequestContextService],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
