/**
 * OpenTelemetry Instrumentation Entry Point for BFF Service
 *
 * Traces request latency through: Kong → BFF → gRPC Services → DB
 *
 * IMPORTANT: This file MUST be loaded BEFORE any other imports!
 * Use: node -r ./dist/instrumentation.js dist/main.js
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'bff-service';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

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

// Create SDK with minimal instrumentations for latency tracing
const sdk = new NodeSDK({
    resource,
    traceExporter,
    textMapPropagator: new W3CTraceContextPropagator(),
    instrumentations: [
        // HTTP: trace incoming requests and outgoing calls
        new HttpInstrumentation({
            ignoreIncomingRequestHook: (req) => {
                // Ignore health checks
                return req.url === '/health' || req.url === '/ready';
            },
        }),
        // gRPC: trace calls to user-service, task-service
        new GrpcInstrumentation({
            ignoreGrpcMethods: ['Check', 'Watch'],
        }),
        // GraphQL: trace resolver execution time
        new GraphQLInstrumentation({
            depth: 1,
            mergeItems: true,
            allowValues: false,
        }),
        // Redis: trace cache operations
        new IORedisInstrumentation(),
    ],
});

// Start the SDK
sdk.start();

console.log(`[OTEL] ${SERVICE_NAME} tracing enabled -> ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

// Graceful shutdown
process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());
