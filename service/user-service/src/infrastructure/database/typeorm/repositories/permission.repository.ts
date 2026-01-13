import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { BaseTenantRepository } from './base.repository';

@Injectable()
export class PermissionRepository extends BaseTenantRepository<Permission> {
  constructor(
    @InjectRepository(Permission)
    repository: Repository<Permission>,
  ) {
    super(repository);
  }

  /**
   * Find permission by resource and action
   */
  async findByResourceAndAction(
    tenantId: string,
    resource: string,
    action: string,
  ): Promise<Permission | null> {
    return this.findOne(tenantId, {
      where: { resource, action } as any,
    });
  }

  /**
   * Find permissions by resource
   */
  async findByResource(tenantId: string, resource: string): Promise<Permission[]> {
    return this.findAll(tenantId, {
      where: { resource } as any,
    });
  }

  /**
   * Find permissions by IDs
   */
  async findByIds(tenantId: string, permissionIds: string[]): Promise<Permission[]> {
    if (!permissionIds || permissionIds.length === 0) {
      return [];
    }

    return this.findAll(tenantId, {
      where: {
        _id: { $in: permissionIds.map((id) => id) } as any,
      } as any,
    });
  }

  /**
   * Get all unique resources
   */
  async getResources(tenantId: string): Promise<string[]> {
    const permissions = await this.findAll(tenantId);
    const resources = new Set(permissions.map((p) => p.resource));
    return Array.from(resources);
  }

  /**
   * Check if permission exists by key
   */
  async existsByKey(tenantId: string, resource: string, action: string): Promise<boolean> {
    return this.exists(tenantId, {
      where: { resource, action } as any,
    });
  }
}
