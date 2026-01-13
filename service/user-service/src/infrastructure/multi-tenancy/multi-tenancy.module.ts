import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './guards/tenant.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionService } from './services/permission.service';
import { TypeOrmRepositoriesModule } from '../database/typeorm/repositories/repositories.module';

/**
 * Global module for multi-tenancy support
 * Provides guards and permission services
 * Uses parameter passing instead of request-scoped context
 */
@Global()
@Module({
  imports: [TypeOrmRepositoriesModule],
  providers: [
    PermissionService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    PermissionsGuard,
    RolesGuard,
  ],
  exports: [PermissionService, PermissionsGuard, RolesGuard],
})
export class MultiTenancyModule {}
