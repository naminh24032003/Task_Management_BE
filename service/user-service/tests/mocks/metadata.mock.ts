/**
 * gRPC Metadata Mock
 * Creates mock Metadata objects for testing gRPC controllers
 */

import { Metadata } from '@grpc/grpc-js';

/**
 * Create a mock Metadata object with common headers
 */
export function createMockMetadata(options: {
    tenantId?: string;
    userId?: string;
    additionalHeaders?: Record<string, string>;
}): Metadata {
    const metadata = new Metadata();

    if (options.tenantId) {
        metadata.set('x-tenant-id', options.tenantId);
    }

    if (options.userId) {
        metadata.set('x-user-id', options.userId);
    }

    if (options.additionalHeaders) {
        Object.entries(options.additionalHeaders).forEach(([key, value]) => {
            metadata.set(key, value);
        });
    }

    return metadata;
}

/**
 * Create metadata with default tenant ID
 */
export function createDefaultMetadata(tenantId: string = 'tenant-123'): Metadata {
    return createMockMetadata({ tenantId });
}

/**
 * Create metadata with tenant ID and user ID (authenticated)
 */
export function createAuthenticatedMetadata(
    tenantId: string = 'tenant-123',
    userId: string = 'user-123',
): Metadata {
    return createMockMetadata({ tenantId, userId });
}

/**
 * Create empty metadata (missing required headers)
 */
export function createEmptyMetadata(): Metadata {
    return new Metadata();
}
