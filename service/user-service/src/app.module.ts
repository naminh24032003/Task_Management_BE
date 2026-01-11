import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { UserController } from './ports/inbound/user.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

@Module({
    imports: [
        InfrastructureModule,
        PrometheusModule.register({
            defaultMetrics: {
                enabled: true,
            },
        }),
    ],
    controllers: [UserController],
    providers: [],
})
export class AppModule { }
