/**
 * User Test Factories
 * Creates test data for User domain objects
 */

import { User, UserStatus, CreateUserProps, UserProps } from '../../src/domain/aggregates/user.aggregate';

/**
 * Default valid password meeting all requirements
 */
export const VALID_PASSWORD = 'SecurePass123!';

/**
 * Default test tenant ID
 */
export const DEFAULT_TENANT_ID = 'tenant-123';

/**
 * Create user props for testing
 */
export function createUserProps(overrides?: Partial<CreateUserProps>): CreateUserProps {
    return {
        tenantId: DEFAULT_TENANT_ID,
        email: 'test@example.com',
        password: VALID_PASSWORD,
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        roleIds: [],
        ...overrides,
    };
}

/**
 * Create a valid User for testing
 */
export function createTestUser(overrides?: Partial<CreateUserProps>): User {
    const props = createUserProps(overrides);
    return User.create(props);
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number, tenantId: string = DEFAULT_TENANT_ID): User[] {
    const users: User[] = [];
    for (let i = 1; i <= count; i++) {
        users.push(
            createTestUser({
                tenantId,
                email: `user${i}@example.com`,
                firstName: `User`,
                lastName: `${i}`,
            }),
        );
    }
    return users;
}

/**
 * Create persisted user props (with ID and dates)
 */
export function createPersistedUserProps(overrides?: Partial<UserProps>): UserProps {
    const now = new Date();
    return {
        id: '507f1f77bcf86cd799439011',
        tenantId: DEFAULT_TENANT_ID,
        email: 'test@example.com',
        passwordHash: 'cc5089d6d6770f3ff14f9b7970640fa24cad6d32797f7f8519abd9ceb589e43159b35adc2054109c2c619e5a656799f2b1197679a846ca457855654aac471a19',
        passwordSalt: '7f9996d913693e54b676f6f966099651582e90c9b3d0c91b5c6e8e8e8e8e8e8e',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        status: UserStatus.ACTIVE,
        roleIds: [],
        createdAt: now,
        updatedAt: now,
        lastLoginAt: undefined,
        provider: undefined,
        providerId: undefined,
        ...overrides,
    };
}

/**
 * Reconstitute a User from persisted props
 */
export function createReconstitutedUser(overrides?: Partial<UserProps>): User {
    const props = createPersistedUserProps(overrides);
    return User.reconstitute(props);
}

/**
 * Create an OAuth user for testing
 */
export function createOAuthUser(
    tenantId: string = DEFAULT_TENANT_ID,
    email: string = 'oauth@example.com',
): User {
    return User.createOAuthUser({
        tenantId,
        email,
        firstName: 'OAuth',
        lastName: 'User',
        displayName: 'OAuth User',
        provider: 'google',
        providerId: 'google-123456',
        roleIds: [],
    });
}
