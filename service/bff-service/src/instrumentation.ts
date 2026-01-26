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
import { W3CTraceContextPropagator } from '@opentelemetry/core';
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
    textMapPropagator: new W3CTraceContextPropagator(),
    instrumentations: [
        // Auto-instrument common Node.js libraries
        getNodeAutoInstrumentations({
            // Disable problematic instrumentations
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
            '@opentelemetry/instrumentation-http': { enabled: true },
            '@opentelemetry/instrumentation-grpc': {
                enabled: true,
                ignoreGrpcMethods: ['Check', 'Watch'],
            },
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
