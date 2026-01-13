import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Tenant } from '../entities/tenant.entity';
import { UserRepository } from './user.repository';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { TenantRepository } from './tenant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, Tenant])],
  providers: [
    UserRepository,
    RoleRepository,
    PermissionRepository,
    TenantRepository,
  ],
  exports: [
    UserRepository,
    RoleRepository,
    PermissionRepository,
    TenantRepository,
  ],
})
export class TypeOrmRepositoriesModule {}
