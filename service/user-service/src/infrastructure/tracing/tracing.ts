import {
    NodeSDK,
    resources,
    api,
} from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

const SERVICE_NAME = 'user-service';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

/**
 * Initialize OpenTelemetry SDK for distributed tracing
 * This must be called BEFORE any other imports in main.ts
 */
export function initTracing(): NodeSDK {
    // Create resource with service information
    const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Create OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
        url: OTEL_EXPORTER_OTLP_ENDPOINT,
    });

    // Create metric exporter (optional)
    const metricExporter = new OTLPMetricExporter({
        url: OTEL_EXPORTER_OTLP_ENDPOINT,
    });

    // Create SDK with auto-instrumentations
    const sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter as any,
            exportIntervalMillis: 10000,
        }) as any,
        instrumentations: [
            // Auto-instrument common Node.js libraries
            getNodeAutoInstrumentations({
                // Disable fs instrumentation to reduce noise
                '@opentelemetry/instrumentation-fs': {
                    enabled: false,
                },
                // Disable grpc if it's causing issues with NestJS microservices
                // '@opentelemetry/instrumentation-grpc': { enabled: false },
            }),
            // Redis instrumentation
            new IORedisInstrumentation(),
        ],
    });

    // Start the SDK
    sdk.start();

    console.log(`🔭 OpenTelemetry tracing initialized for ${SERVICE_NAME}`);
    console.log(`📤 Exporting traces to: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => console.log('OpenTelemetry SDK shut down successfully'))
            .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error))
            .finally(() => process.exit(0));
    });

    return sdk;
}
