import { Permission } from '../../infrastructure/database/typeorm/entities/permission.entity';

export const PERMISSION_REPOSITORY = 'PERMISSION_REPOSITORY';

export interface IPermissionRepository {
    findById(tenantId: string, id: string): Promise<Permission | null>;
    findByIds(tenantId: string, ids: string[]): Promise<Permission[]>;
    findByResourceAndAction(tenantId: string, resource: string, action: string): Promise<Permission | null>;
    save(permission: Permission): Promise<Permission>;
}
