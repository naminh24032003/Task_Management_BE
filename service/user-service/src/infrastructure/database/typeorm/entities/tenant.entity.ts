import { Entity, Column, Index } from 'typeorm';
import { ObjectIdColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Types } from 'mongoose';

/**
 * Tenant entity
 * Each tenant represents an organization or workspace
 */
@Entity('tenants')
export class Tenant {
  @ObjectIdColumn()
  _id: Types.ObjectId;

  @Column({ unique: true })
  @Index({ unique: true })
  tenantId: string; // Unique identifier for tenant (e.g., org-123)

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  settings?: {
    maxUsers?: number;
    features?: string[];
    customConfig?: Record<string, any>;
  };

  @Column({ nullable: true })
  ownerId?: string; // Reference to user who owns this tenant

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  get id(): string {
    return this._id.toString();
  }
}
