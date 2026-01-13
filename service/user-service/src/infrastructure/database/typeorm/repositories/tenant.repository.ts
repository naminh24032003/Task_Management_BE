import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { ObjectId } from 'mongodb';

/**
 * Tenant repository without tenant scoping
 * Since Tenant entity doesn't have tenantId field
 */
@Injectable()
export class TenantRepository {
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) {}

  /**
   * Find tenant by tenant ID
   */
  async findByTenantId(tenantId: string): Promise<Tenant | null> {
    return this.repository.findOne({
      where: { tenantId, isDeleted: false } as any,
    });
  }

  /**
   * Find tenant by tenant ID or fail
   */
  async findByTenantIdOrFail(tenantId: string): Promise<Tenant> {
    const tenant = await this.findByTenantId(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }
    return tenant;
  }

  /**
   * Find tenant by MongoDB _id
   */
  async findById(id: string | ObjectId): Promise<Tenant | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.repository.findOne({
      where: { _id: objectId, isDeleted: false } as any,
    });
  }

  /**
   * Find all active tenants
   */
  async findAll(): Promise<Tenant[]> {
    return this.repository.find({
      where: { isDeleted: false } as any,
    });
  }

  /**
   * Find active tenants only
   */
  async findActiveTenants(): Promise<Tenant[]> {
    return this.repository.find({
      where: { isActive: true, isDeleted: false } as any,
    });
  }

  /**
   * Create new tenant
   */
  async create(data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.repository.create(data);
    return this.repository.save(tenant);
  }

  /**
   * Update tenant
   */
  async update(tenantId: string, data: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.findByTenantIdOrFail(tenantId);
    Object.assign(tenant, data);
    return this.repository.save(tenant);
  }

  /**
   * Soft delete tenant
   */
  async softDelete(tenantId: string): Promise<void> {
    const tenant = await this.findByTenantIdOrFail(tenantId);
    tenant.isDeleted = true;
    tenant.deletedAt = new Date();
    await this.repository.save(tenant);
  }

  /**
   * Activate tenant
   */
  async activate(tenantId: string): Promise<Tenant> {
    return this.update(tenantId, { isActive: true });
  }

  /**
   * Deactivate tenant
   */
  async deactivate(tenantId: string): Promise<Tenant> {
    return this.update(tenantId, { isActive: false });
  }

  /**
   * Check if tenant exists
   */
  async exists(tenantId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { tenantId, isDeleted: false } as any,
    });
    return count > 0;
  }
}
