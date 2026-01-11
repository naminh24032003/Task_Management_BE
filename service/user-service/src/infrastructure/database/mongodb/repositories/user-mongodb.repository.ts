import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

export interface UserFilter {
  userId?: string;
  email?: string;
  status?: string;
  isEmailVerified?: boolean;
  deletedAt?: Date | null;
}

export interface UserPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UserMongoDbRepository {
  private readonly logger = new Logger(UserMongoDbRepository.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userData: Partial<User>, session?: ClientSession): Promise<User> {
    this.logger.log(`Creating user: ${userData.email}`);

    const user = new this.userModel(userData);
    const savedUser = await user.save({ session });

    return savedUser.toObject();
  }

  async findById(userId: string): Promise<User | null> {
    this.logger.debug(`Finding user by ID: ${userId}`);

    const user = await this.userModel
      .findOne({ userId, deletedAt: null })
      .lean()
      .exec();

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Finding user by email: ${email}`);

    const user = await this.userModel
      .findOne({ email, deletedAt: null })
      .lean()
      .exec();

    return user;
  }

  async findOne(filter: UserFilter): Promise<User | null> {
    this.logger.debug(`Finding user with filter: ${JSON.stringify(filter)}`);

    const query: any = { ...filter };
    if (filter.deletedAt === null) {
      query.deletedAt = null;
    }

    const user = await this.userModel
      .findOne(query)
      .lean()
      .exec();

    return user;
  }

  async findMany(
    filter: UserFilter,
    options?: UserPaginationOptions,
  ): Promise<PaginatedResult<User>> {
    this.logger.debug(
      `Finding users with filter: ${JSON.stringify(filter)}, options: ${JSON.stringify(options)}`,
    );

    const query: any = { ...filter };
    if (filter.deletedAt === null) {
      query.deletedAt = null;
    }

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    userId: string,
    updateData: Partial<User>,
    session?: ClientSession,
  ): Promise<User | null> {
    this.logger.log(`Updating user: ${userId}`);

    const user = await this.userModel
      .findOneAndUpdate(
        { userId, deletedAt: null },
        { $set: updateData },
        { new: true, session, runValidators: true },
      )
      .lean()
      .exec();

    return user;
  }

  async delete(userId: string, session?: ClientSession): Promise<boolean> {
    this.logger.log(`Hard deleting user: ${userId}`);

    const result = await this.userModel
      .deleteOne({ userId }, { session })
      .exec();

    return result.deletedCount > 0;
  }

  async softDelete(userId: string, session?: ClientSession): Promise<boolean> {
    this.logger.log(`Soft deleting user: ${userId}`);

    const result = await this.userModel
      .updateOne(
        { userId, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { session },
      )
      .exec();

    return result.modifiedCount > 0;
  }

  async exists(filter: UserFilter): Promise<boolean> {
    const query: any = { ...filter };
    if (filter.deletedAt === null) {
      query.deletedAt = null;
    }

    const count = await this.userModel.countDocuments(query).exec();
    return count > 0;
  }

  async count(filter: UserFilter): Promise<number> {
    const query: any = { ...filter };
    if (filter.deletedAt === null) {
      query.deletedAt = null;
    }

    return await this.userModel.countDocuments(query).exec();
  }

  async startSession(): Promise<ClientSession> {
    return await this.userModel.db.startSession();
  }

  async withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.startSession();

    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel
      .updateOne({ userId }, { $set: { lastLoginAt: new Date() } })
      .exec();
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { userId },
        {
          $set: {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async addDomainEvent(
    userId: string,
    eventType: string,
    eventData: Record<string, any>,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { userId },
        {
          $push: {
            domainEvents: {
              eventType,
              eventData,
              occurredAt: new Date(),
            },
          },
        },
      )
      .exec();
  }

  async clearDomainEvents(userId: string): Promise<void> {
    await this.userModel
      .updateOne({ userId }, { $set: { domainEvents: [] } })
      .exec();
  }
}
