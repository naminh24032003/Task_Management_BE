import { Role } from '../../domain/entities/role.entity';

export const ROLE_REPOSITORY = Symbol('IRoleRepository');

/**
 * Role Repository Port (Interface)
 * Defines the contract for role persistence operations
 */
export interface IRoleRepository {
    /**
     * Find role by ID within tenant
     */
    findById(tenantId: string, id: string): Promise<Role | null>;

    /**
     * Find roles by IDs within tenant
     */
    findByIds(tenantId: string, ids: string[]): Promise<Role[]>;

    /**
     * Find role by name within tenant
     */
    findByName(tenantId: string, name: string): Promise<Role | null>;

    /**
     * Save role (create or update)
     */
    save(role: Role): Promise<Role>;

    /**
     * Find all roles within tenant
     */
    findAll(tenantId: string): Promise<Role[]>;

    /**
     * Delete role
     */
    delete(tenantId: string, roleId: string): Promise<void>;
}

