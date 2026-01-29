import { AggregateRoot } from '@nestjs/cqrs';

/**
 * Permission Domain Entity
 * Represents a specific permission for a resource action
 */
export class Permission extends AggregateRoot {
    private readonly _id: string;
    private readonly _tenantId: string;
    private _resource: string;
    private _action: string;
    private _description: string;
    private readonly _createdAt: Date;
    private _updatedAt: Date;

    private constructor(props: {
        id: string;
        tenantId: string;
        resource: string;
        action: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
    }) {
        super();
        this._id = props.id;
        this._tenantId = props.tenantId;
        this._resource = props.resource;
        this._action = props.action;
        this._description = props.description;
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

    get resource(): string {
        return this._resource;
    }

    get action(): string {
        return this._action;
    }

    get description(): string {
        return this._description;
    }

    get createdAt(): Date {
        return this._createdAt;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }

    /**
     * Get permission key (resource:action format)
     */
    get key(): string {
        return `${this._resource}:${this._action}`;
    }

    /**
     * Factory method to create a new permission
     */
    static create(props: {
        id: string;
        tenantId: string;
        resource: string;
        action: string;
        description?: string;
    }): Permission {
        const now = new Date();
        return new Permission({
            id: props.id,
            tenantId: props.tenantId,
            resource: props.resource,
            action: props.action,
            description: props.description || '',
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
        resource: string;
        action: string;
        description: string;
        createdAt: Date;
        updatedAt: Date;
    }): Permission {
        return new Permission(props);
    }

    /**
     * Update description
     */
    updateDescription(description: string): void {
        this._description = description;
        this._updatedAt = new Date();
    }

    /**
     * Check if permission matches resource and action
     */
    matches(resource: string, action: string): boolean {
        return this._resource === resource && this._action === action;
    }
}
