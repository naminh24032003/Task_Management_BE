import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_CHECK } from '../guards/tenant.guard';

/**
 * Decorator to skip tenant check for specific routes
 * Useful for public endpoints or health checks
 * Usage: @SkipTenantCheck()
 */
export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_CHECK, true);
