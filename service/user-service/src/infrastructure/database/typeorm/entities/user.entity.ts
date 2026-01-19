import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
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

  @Column({ select: false })
  passwordHash: string;

  @Column({ select: false })
  passwordSalt: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'simple-array', default: [] })
  roleIds: string[];

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerifiedAt?: Date;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  @Column({ nullable: true })
  provider?: string; // OAuth provider: google, facebook, github

  @Column({ nullable: true })
  providerId?: string; // OAuth provider user ID

  @Column({ type: 'simple-json', nullable: true })
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.email;
  }
}
