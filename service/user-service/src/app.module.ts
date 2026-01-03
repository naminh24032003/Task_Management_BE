import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { UserController } from './ports/inbound/user.controller';

@Module({
    imports: [
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
