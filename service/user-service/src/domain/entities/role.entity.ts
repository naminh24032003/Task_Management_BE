import { AggregateRoot } from '@nestjs/cqrs';

/**
 * Role Domain Entity
 * Represents a role within a tenant with associated permissions
 */
export class Role extends AggregateRoot {
    private readonly _id: string;
    private readonly _tenantId: string;
    private _name: string;
    private _description: string;
    private _permissionIds: string[];
    private _isSystem: boolean;
    private readonly _createdAt: Date;
    private _updatedAt: Date;

    private constructor(props: {
        id: string;
        tenantId: string;
        name: string;
        description: string;
        permissionIds: string[];
        isSystem: boolean;
        createdAt: Date;
        updatedAt: Date;
    }) {
        super();
        this._id = props.id;
        this._tenantId = props.tenantId;
        this._name = props.name;
        this._description = props.description;
        this._permissionIds = [...props.permissionIds];
        this._isSystem = props.isSystem;
        this._createdAt = props.createdAt;
        this._updatedAt = props.updatedAt;
    }

    // Getters
    get id(): string {
        return this._id;
    }

    get tenantId(): string {
        return this._tenantId;
    }

    get name(): string {
        return this._name;
    }

    get description(): string {
        return this._description;
    }

    get permissionIds(): readonly string[] {
        return [...this._permissionIds];
    }

    get isSystem(): boolean {
        return this._isSystem;
    }

    get createdAt(): Date {
        return this._createdAt;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }

    /**
     * Factory method to create a new role
     */
    static create(props: {
        id: string;
        tenantId: string;
        name: string;
        description?: string;
        permissionIds?: string[];
        isSystem?: boolean;
    }): Role {
        const now = new Date();
        return new Role({
            id: props.id,
            tenantId: props.tenantId,
            name: props.name,
            description: props.description || '',
            permissionIds: props.permissionIds || [],
            isSystem: props.isSystem || false,
            createdAt: now,
            updatedAt: now,
        });
    }

    /**
     * Reconstitute from persistence
     */
    static reconstitute(props: {
        id: string;
        tenantId: string;
        name: string;
        description: string;
        permissionIds: string[];
        isSystem: boolean;
        createdAt: Date;
        updatedAt: Date;
    }): Role {
        return new Role(props);
    }

    /**
     * Update role name
     */
    updateName(name: string): void {
        if (this._isSystem) {
            throw new Error('Cannot modify system role');
        }
        this._name = name;
        this._updatedAt = new Date();
    }

    /**
     * Update role description
     */
    updateDescription(description: string): void {
        this._description = description;
        this._updatedAt = new Date();
    }

    /**
     * Add permission to role
     */
    addPermission(permissionId: string): void {
        if (!this._permissionIds.includes(permissionId)) {
            this._permissionIds.push(permissionId);
            this._updatedAt = new Date();
        }
    }

    /**
     * Remove permission from role
     */
    removePermission(permissionId: string): void {
        const index = this._permissionIds.indexOf(permissionId);
        if (index > -1) {
            this._permissionIds.splice(index, 1);
            this._updatedAt = new Date();
        }
    }

    /**
     * Check if role has permission
     */
    hasPermission(permissionId: string): boolean {
        return this._permissionIds.includes(permissionId);
    }
}
