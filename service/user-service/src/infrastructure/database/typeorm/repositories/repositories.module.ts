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
import { UserDomainRepository } from './user-domain.repository';
import { USER_REPOSITORY } from '../../../../application/ports/user-repository.port';
import { ROLE_REPOSITORY } from '../../../../application/ports/role-repository.port';
import { PERMISSION_REPOSITORY } from '../../../../application/ports/permission-repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, Tenant])],
  providers: [
    UserRepository,
    RoleRepository,
    PermissionRepository,
    TenantRepository,
    UserDomainRepository,
    {
      provide: USER_REPOSITORY,
      useClass: UserDomainRepository,
    },
    {
      provide: ROLE_REPOSITORY,
      useClass: RoleRepository,
    },
    {
      provide: PERMISSION_REPOSITORY,
      useClass: PermissionRepository,
    },
  ],
  exports: [
    UserRepository,
    RoleRepository,
    PermissionRepository,
    TenantRepository,
    UserDomainRepository,
    USER_REPOSITORY,
    ROLE_REPOSITORY,
    PERMISSION_REPOSITORY,
  ],
})
export class TypeOrmRepositoriesModule { }
