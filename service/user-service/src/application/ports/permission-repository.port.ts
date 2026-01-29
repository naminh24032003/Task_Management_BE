import { Permission } from '../../domain/entities/permission.entity';

export const PERMISSION_REPOSITORY = Symbol('IPermissionRepository');

/**
 * Permission Repository Port (Interface)
 * Defines the contract for permission persistence operations
 */
export interface IPermissionRepository {
    /**
     * Find permission by ID within tenant
     */
    findById(tenantId: string, id: string): Promise<Permission | null>;

    /**
     * Find permissions by IDs within tenant
     */
    findByIds(tenantId: string, ids: string[]): Promise<Permission[]>;

    /**
     * Find permission by resource and action
     */
    findByResourceAndAction(
        tenantId: string,
        resource: string,
        action: string,
    ): Promise<Permission | null>;

    /**
     * Save permission (create or update)
     */
    save(permission: Permission): Promise<Permission>;

    /**
     * Find all permissions within tenant
     */
    findAll(tenantId: string): Promise<Permission[]>;

    /**
     * Delete permission
     */
    delete(tenantId: string, permissionId: string): Promise<void>;
}

