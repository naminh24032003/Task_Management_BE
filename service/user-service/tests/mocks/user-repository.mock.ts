/**
 * User Repository Mock Factory
 * Creates mock implementations for testing
 */

import { IUserRepository } from '../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../src/domain/aggregates/user.aggregate';

export type MockUserRepository = jest.Mocked<IUserRepository>;

/**
 * Create a fully mocked user repository
 */
export function createMockUserRepository(): MockUserRepository {
    return {
        findById: jest.fn(),
        findByEmail: jest.fn(),
        emailExists: jest.fn(),
        isEmailUnique: jest.fn(),
        save: jest.fn(),
        findAll: jest.fn(),
        delete: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;
}

/**
 * Create an in-memory user repository for testing
 */
export function createInMemoryUserRepository(): IUserRepository {
    const users: Map<string, User> = new Map();

    return {
        findById: async (tenantId: string, userId: string): Promise<User | null> => {
            for (const user of users.values()) {
                if (user.tenantId === tenantId && user.id.toString() === userId) {
                    return user;
                }
            }
            return null;
        },

        findByEmail: async (tenantId: string, email: string): Promise<User | null> => {
            for (const user of users.values()) {
                if (user.tenantId === tenantId && user.email.toString() === email.toLowerCase()) {
                    return user;
                }
            }
            return null;
        },

        emailExists: async (tenantId: string, email: string): Promise<boolean> => {
            for (const user of users.values()) {
                if (user.tenantId === tenantId && user.email.toString() === email.toLowerCase()) {
                    return true;
                }
            }
            return false;
        },

        isEmailUnique: async (tenantId: string, email: string, excludeUserId?: string): Promise<boolean> => {
            for (const user of users.values()) {
                if (
                    user.tenantId === tenantId &&
                    user.email.toString() === email.toLowerCase() &&
                    user.id.toString() !== excludeUserId
                ) {
                    return false;
                }
            }
            return true;
        },

        save: async (user: User): Promise<User> => {
            const key = `${user.tenantId}:${user.id.toString()}`;
            users.set(key, user);
            return user;
        },

        findAll: async (
            tenantId: string,
            options: { page?: number; limit?: number; status?: string },
        ): Promise<{ users: User[]; total: number }> => {
            const filtered: User[] = [];
            for (const user of users.values()) {
                if (user.tenantId === tenantId) {
                    if (!options.status || user.status === options.status) {
                        filtered.push(user);
                    }
                }
            }

            const page = options.page || 1;
            const limit = options.limit || 10;
            const start = (page - 1) * limit;
            const paged = filtered.slice(start, start + limit);

            return { users: paged, total: filtered.length };
        },

        delete: async (tenantId: string, userId: string): Promise<void> => {
            const key = `${tenantId}:${userId}`;
            const user = users.get(key);
            if (user) {
                user.delete();
                users.set(key, user);
            }
        },
    };
}
