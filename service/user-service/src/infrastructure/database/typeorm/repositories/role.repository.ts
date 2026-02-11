import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Role } from '../entities/role.entity';
import { BaseTenantRepository } from './base.repository';

@Injectable()
export class RoleRepository extends BaseTenantRepository<Role> {
  constructor(
    @InjectRepository(Role)
    repository: Repository<Role>,
  ) {
    super(repository);
  }

  /**
   * Find role by name within specified tenant
   */
  async findByName(tenantId: string, name: string): Promise<Role | null> {
    return this.findOne(tenantId, {
      where: { name } as any,
    });
  }

  /**
   * Find all system roles
   */
  async findSystemRoles(tenantId: string): Promise<Role[]> {
    return this.findAll(tenantId, {
      where: { isSystem: true } as any,
    });
  }

  /**
   * Find roles by IDs
   */
  async findByIds(tenantId: string, roleIds: string[]): Promise<Role[]> {
    if (!roleIds || roleIds.length === 0) {
      return [];
    }

    return this.findAll(tenantId, {
      where: {
        _id: { $in: roleIds.map((id) => new ObjectId(id)) } as any,
      } as any,
    });
  }

  /**
   * Add permission to role
   */
  async addPermission(tenantId: string, roleId: string, permissionId: string): Promise<Role> {
    const role = await this.findByIdOrFail(tenantId, roleId);
    if (!role.permissionIds.includes(permissionId)) {
      role.permissionIds.push(permissionId);
      return this.repository.save(role);
    }
    return role;
  }

  /**
   * Remove permission from role
   */
  async removePermission(tenantId: string, roleId: string, permissionId: string): Promise<Role> {
    const role = await this.findByIdOrFail(tenantId, roleId);
    role.permissionIds = role.permissionIds.filter((id) => id !== permissionId);
    return this.repository.save(role);
  }

  /**
   * Set all permissions for role
   */
  async setPermissions(tenantId: string, roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findByIdOrFail(tenantId, roleId);
    role.permissionIds = permissionIds;
    return this.repository.save(role);
  }
}
