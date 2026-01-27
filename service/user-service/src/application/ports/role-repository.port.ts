import { Role } from '../../infrastructure/database/typeorm/entities/role.entity';

export const ROLE_REPOSITORY = 'ROLE_REPOSITORY';

export interface IRoleRepository {
    findById(tenantId: string, id: string): Promise<Role | null>;
    findByIds(tenantId: string, ids: string[]): Promise<Role[]>;
    findByName(tenantId: string, name: string): Promise<Role | null>;
    save(role: Role): Promise<Role>;
}
