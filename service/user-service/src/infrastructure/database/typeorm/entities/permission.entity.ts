import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Permission entity
 * Represents fine-grained permissions (e.g., 'users:read', 'tasks:write')
 */
@Entity('permissions')
@Index(['tenantId', 'resource', 'action'], { unique: true })
export class Permission extends BaseEntity {
  @Column()
  name: string; // Display name (e.g., "Read Users")

  @Column()
  resource: string; // Resource type (e.g., "users", "tasks", "projects")

  @Column()
  action: string; // Action (e.g., "read", "write", "delete", "manage")

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'simple-array', default: [] })
  conditions?: string[]; // Optional conditions for dynamic permissions

  // Helper to get permission key
  get key(): string {
    return `${this.resource}:${this.action}`;
  }
}
