import { Module, Global } from '@nestjs/common';
import { TracingService } from './tracing.service';

/**
 * TracingModule provides OpenTelemetry integration for BFF Service
 */
@Global()
@Module({
    providers: [TracingService],
    exports: [TracingService],
})
export class TracingModule { }
