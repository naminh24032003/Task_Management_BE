import { Repository, FindOptionsWhere, FindManyOptions, FindOneOptions } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';

/**
 * Base repository with tenant filtering via parameter passing
 * All queries require tenantId to be passed explicitly
 */
@Injectable()
export abstract class BaseTenantRepository<T extends BaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  /**
   * Get tenant filter for queries
   */
  protected getTenantFilter(tenantId: string): FindOptionsWhere<T> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return { tenantId, isDeleted: false } as FindOptionsWhere<T>;
  }

  /**
   * Find all entities for specified tenant
   */
  async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...this.getTenantFilter(tenantId),
        ...(options?.where || {}),
      },
    });
  }

  /**
   * Find one entity by ID for specified tenant
   */
  async findById(tenantId: string, id: string | ObjectId): Promise<T | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.repository.findOne({
      where: {
        ...this.getTenantFilter(tenantId),
        _id: objectId,
      } as FindOptionsWhere<T>,
    });
  }

  /**
   * Find one entity by ID or throw error
   */
  async findByIdOrFail(tenantId: string, id: string | ObjectId): Promise<T> {
    const entity = await this.findById(tenantId, id);
    if (!entity) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }
    return entity;
  }

  /**
   * Find one entity by criteria
   */
  async findOne(tenantId: string, options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: {
        ...this.getTenantFilter(tenantId),
        ...(options.where || {}),
      },
    });
  }

  /**
   * Create and save entity with tenant ID
   */
  async create(tenantId: string, data: Partial<T>): Promise<T> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const entity = this.repository.create({
      ...data,
      tenantId,
    } as any);

    return this.repository.save(entity);
  }

  /**
   * Update entity by ID
   */
  async update(tenantId: string, id: string | ObjectId, data: Partial<T>): Promise<T> {
    const entity = await this.findByIdOrFail(tenantId, id);
    Object.assign(entity, data);
    return this.repository.save(entity);
  }

  /**
   * Soft delete entity by ID
   */
  async softDelete(tenantId: string, id: string | ObjectId): Promise<void> {
    const entity = await this.findByIdOrFail(tenantId, id);
    entity.isDeleted = true;
    entity.deletedAt = new Date();
    await this.repository.save(entity);
  }

  /**
   * Hard delete entity by ID
   */
  async hardDelete(tenantId: string, id: string | ObjectId): Promise<void> {
    const entity = await this.findByIdOrFail(tenantId, id);
    await this.repository.remove(entity);
  }

  /**
   * Count entities for specified tenant
   */
  async count(tenantId: string, options?: FindManyOptions<T>): Promise<number> {
    return this.repository.count({
      ...options,
      where: {
        ...this.getTenantFilter(tenantId),
        ...(options?.where || {}),
      },
    });
  }

  /**
   * Check if entity exists
   */
  async exists(tenantId: string, options: FindOneOptions<T>): Promise<boolean> {
    const count = await this.repository.count({
      ...options,
      where: {
        ...this.getTenantFilter(tenantId),
        ...(options.where || {}),
      },
    });
    return count > 0;
  }
}
