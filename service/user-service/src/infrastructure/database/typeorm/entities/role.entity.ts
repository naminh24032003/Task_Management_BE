import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Role entity
 * Represents a role within a tenant (e.g., "admin", "manager", "user")
 */
@Entity('roles')
@Index(['tenantId', 'name'], { unique: true })
export class Role extends BaseEntity {
  @Column()
  name: string; // Role name (e.g., "admin", "manager", "user")

  @Column({ nullable: true })
  description?: string;

  @Column({ default: false })
  isSystem: boolean; // System roles cannot be deleted

  @Column({ type: 'simple-array', default: [] })
  permissionIds: string[]; // Array of permission IDs (MongoDB ObjectIds as strings)

  @Column({ type: 'simple-json', nullable: true })
  metadata?: {
    color?: string;
    icon?: string;
    priority?: number;
    [key: string]: any;
  };
}
