import { Module, Global } from '@nestjs/common';
import { TracingService } from './tracing.service';

/**
 * TracingModule provides OpenTelemetry integration for NestJS
 * This module provides tracing capabilities across all services
 */
@Global()
@Module({
    providers: [TracingService],
    exports: [TracingService],
})
export class TracingModule { }
