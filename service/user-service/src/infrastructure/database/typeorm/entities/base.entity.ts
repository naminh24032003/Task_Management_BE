import {
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectId } from 'mongodb';

/**
 * Base entity with common fields for all entities
 * Includes tenant support for multi-tenancy
 */
export abstract class BaseEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  @Index()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  // Helper to get string ID
  get id(): string {
    return this._id.toString();
  }
}
