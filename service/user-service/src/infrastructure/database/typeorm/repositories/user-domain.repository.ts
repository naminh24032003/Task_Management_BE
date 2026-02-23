import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { User as UserEntity, UserStatus as EntityUserStatus } from '../entities/user.entity';
import { User, UserStatus as DomainUserStatus, UserProps, OAuthProvider } from '../../../../domain/aggregates/user.aggregate';
import { IUserRepository, FindAllWithCursorResult } from '../../../../application/ports/user-repository.port';
import { encodeCursor, decodeCursor, normalizeLimit } from '@task-management/shared';

/**
 * User Repository Implementation
 * Bridges Domain and Infrastructure layers
 */
@Injectable()
export class UserDomainRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findById(tenantId: string, userId: string): Promise<User | null> {
    // Convert string ID to ObjectId for MongoDB query
    const objectId = new ObjectId(userId);
    const entity = await this.repository.findOne({
      where: { tenantId, _id: objectId, isDeleted: false } as any,
    });

    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { tenantId, email: email.toLowerCase(), isDeleted: false } as any,
    });

    return entity ? this.toDomain(entity) : null;
  }

  async emailExists(tenantId: string, email: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { tenantId, email: email.toLowerCase(), isDeleted: false } as any,
    });
    return count > 0;
  }

  async isEmailUnique(tenantId: string, email: string, excludeUserId?: string): Promise<boolean> {
    const entity = await this.repository.findOne({
      where: { tenantId, email: email.toLowerCase(), isDeleted: false } as any,
    });

    if (!entity) {
      return true;
    }

    // If excludeUserId is provided, check if the found user is the same
    if (excludeUserId && entity._id.toString() === excludeUserId) {
      return true;
    }

    return false;
  }

  async save(user: User): Promise<User> {
    const entity = this.toEntity(user);
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findAll(
    tenantId: string,
    options: {
      page: number;
      pageSize: number;
      status?: string;
      search?: string;
    },
  ): Promise<{ users: User[]; total: number }> {
    const { page, pageSize, status, search } = options;
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId, isDeleted: false };

    if (status) {
      where.status = status;
    }

    // Note: For MongoDB with TypeORM, search might need different approach
    // This is a simplified version
    const [entities, total] = await this.repository.findAndCount({
      where,
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' } as any,
    });

    return {
      users: entities.map((e) => this.toDomain(e)),
      total,
    };
  }

  async findAllWithCursor(
    tenantId: string,
    options: {
      page: number;
      pageSize: number;
      status?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    },
  ): Promise<FindAllWithCursorResult> {
    const limit = normalizeLimit(options.limit || 20);
    const where: any = { tenantId, isDeleted: false };

    if (options.status) {
      where.status = options.status;
    }

    // Decode cursor and add cursor-based filter
    if (options.cursor) {
      const cursorData = decodeCursor(options.cursor);
      const cursorDate = new Date(cursorData.value);
      const cursorId = new ObjectId(cursorData.id);

      // Descending sort: get items created before cursor
      where.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } },
      ];
    }

    // Fetch limit + 1 to determine hasMore
    const [entities, totalCount] = await Promise.all([
      this.repository.find({
        where,
        order: { createdAt: 'DESC' } as any,
        take: limit + 1,
      }),
      this.repository.count({ where: { tenantId, isDeleted: false, ...(options.status ? { status: options.status } : {}) } as any }),
    ]);

    const hasMore = entities.length > limit;
    const items = hasMore ? entities.slice(0, limit) : entities;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = encodeCursor(
        lastItem._id.toString(),
        lastItem.createdAt.toISOString(),
      );
    }

    return {
      users: items.map((e) => this.toDomain(e)),
      nextCursor,
      hasMore,
      totalCount,
    };
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    await this.repository.update(
      { tenantId, _id: userId as any } as any,
      { isDeleted: true, deletedAt: new Date(), status: EntityUserStatus.DELETED } as any,
    );
  }

  /**
   * Convert TypeORM entity to Domain aggregate
   */
  private toDomain(entity: UserEntity): User {
    const props: UserProps = {
      id: entity._id.toString(),
      tenantId: entity.tenantId,
      email: entity.email,
      passwordHash: entity.passwordHash,
      passwordSalt: entity.passwordSalt,
      firstName: entity.firstName,
      lastName: entity.lastName,
      displayName: entity.displayName,
      status: entity.status as DomainUserStatus,
      roleIds: entity.roleIds || [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lastLoginAt: entity.lastLoginAt,
      provider: entity.provider as OAuthProvider,
      providerId: entity.providerId,
    };

    return User.reconstitute(props);
  }

  /**
   * Convert Domain aggregate to TypeORM entity
   */
  private toEntity(user: User): Partial<UserEntity> {
    return {
      _id: user.id.toObjectId() as any,
      tenantId: user.tenantId,
      email: user.email.toString(),
      passwordHash: user.getPasswordHash(),
      passwordSalt: user.getPasswordSalt(),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      status: user.status,
      roleIds: user.roleIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      provider: user.provider,
      providerId: user.providerId,
      isDeleted: user.status === DomainUserStatus.DELETED,
    };
  }
}
