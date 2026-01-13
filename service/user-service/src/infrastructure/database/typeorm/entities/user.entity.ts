import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

/**
 * User entity with multi-tenant and role-based access control support
 */
@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User extends BaseEntity {
  @Column()
  email: string;

  @Column({ nullable: true })
  username?: string;

  @Column({ select: false }) // Don't select password by default
  password: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ type: 'simple-array', default: [] })
  roleIds: string[]; // Array of role IDs (MongoDB ObjectIds as strings)

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerifiedAt?: Date;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  @Column({ type: 'simple-json', nullable: true })
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  // Helper to get full name
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.email;
  }
}
