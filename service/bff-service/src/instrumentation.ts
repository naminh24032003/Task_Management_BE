/**
 * OpenTelemetry Instrumentation Entry Point for BFF Service
 * 
 * IMPORTANT: This file MUST be loaded BEFORE any other imports!
 * Use: node -r ./dist/instrumentation.js dist/main.js
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Enable debug logging (optional, for troubleshooting)
if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'bff-service';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

console.log(`🔭 Initializing OpenTelemetry for ${SERVICE_NAME}`);
console.log(`📤 OTLP Endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

// Create resource with service information
const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    'service.namespace': 'task-management',
});

// Create OTLP trace exporter
const traceExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
});

// Create SDK with auto-instrumentations
const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
        // Auto-instrument common Node.js libraries
        getNodeAutoInstrumentations({
            // Disable fs instrumentation to reduce noise
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
            '@opentelemetry/instrumentation-dns': {
                enabled: false,
            },
        }),
        // gRPC instrumentation for calls to user-service
        new GrpcInstrumentation({
            ignoreGrpcMethods: ['Check', 'Watch'],
        }),
        // HTTP instrumentation for incoming requests from Kong
        new HttpInstrumentation({
            ignoreIncomingPaths: ['/metrics', '/health', '/ready', '/.well-known/apollo/server-health'],
        }),
        // GraphQL instrumentation
        new GraphQLInstrumentation({
            depth: 2,
            mergeItems: true,
            allowValues: true,
        }),
        // Redis instrumentation
        new IORedisInstrumentation(),
    ],
});

// Start the SDK
sdk.start();

console.log(`✅ OpenTelemetry initialized successfully`);

// Graceful shutdown
const shutdown = async () => {
    console.log('🔄 Shutting down OpenTelemetry SDK...');
    try {
        await sdk.shutdown();
        console.log('✅ OpenTelemetry SDK shut down successfully');
    } catch (error) {
        console.error('❌ Error shutting down OpenTelemetry SDK', error);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
