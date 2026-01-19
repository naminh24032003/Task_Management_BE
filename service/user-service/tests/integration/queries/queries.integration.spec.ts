/**
 * Integration Tests for Query Handlers
 * Tests the full query flow with NestJS Test Module
 */

import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus, CqrsModule } from '@nestjs/cqrs';
import { GetUserByIdHandler } from '../../../src/application/queries/get-user-by-id/get-user-by-id.handler';
import { GetUserByIdQuery } from '../../../src/application/queries/get-user-by-id/get-user-by-id.query';
import { ListUsersHandler } from '../../../src/application/queries/list-users/list-users.handler';
import { ListUsersQuery } from '../../../src/application/queries/list-users/list-users.query';
import { IUserRepository, USER_REPOSITORY } from '../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../src/domain/aggregates/user.aggregate';
import { UserNotFoundError } from '../../../src/application/errors/user-not-found.error';
import { createInMemoryUserRepository } from '../../mocks/user-repository.mock';
import { createTestUser, DEFAULT_TENANT_ID } from '../../factories/user.factory';

describe('Query Integration Tests', () => {
    let module: TestingModule;
    let queryBus: QueryBus;
    let userRepository: IUserRepository;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CqrsModule],
            providers: [
                GetUserByIdHandler,
                ListUsersHandler,
                {
                    provide: USER_REPOSITORY,
                    useFactory: createInMemoryUserRepository,
                },
            ],
        }).compile();

        await module.init();

        queryBus = module.get<QueryBus>(QueryBus);
        userRepository = module.get<IUserRepository>(USER_REPOSITORY);

        // Register query handlers
        queryBus.register([GetUserByIdHandler, ListUsersHandler]);
    });

    afterEach(async () => {
        await module.close();
    });

    describe('GetUserByIdQuery', () => {
        it('should return user when found', async () => {
            const user = createTestUser({ email: 'findme@test.com' });
            await userRepository.save(user);

            const query = new GetUserByIdQuery(DEFAULT_TENANT_ID, user.id.toString());
            const result = await queryBus.execute(query);

            expect(result).toBeDefined();
            expect(result.user).toBeInstanceOf(User);
            expect(result.user.email.toString()).toBe('findme@test.com');
        });

        it('should throw UserNotFoundError when user does not exist', async () => {
            const query = new GetUserByIdQuery(DEFAULT_TENANT_ID, '507f1f77bcf86cd799439011');

            await expect(queryBus.execute(query)).rejects.toThrow(UserNotFoundError);
        });

        it('should enforce multi-tenancy isolation', async () => {
            const user = createTestUser({ tenantId: 'tenant-a', email: 'isolated@test.com' });
            await userRepository.save(user);

            // Try to find user from different tenant
            const query = new GetUserByIdQuery('tenant-b', user.id.toString());

            await expect(queryBus.execute(query)).rejects.toThrow(UserNotFoundError);
        });

        it('should return correct user data', async () => {
            const user = createTestUser({
                email: 'datatest@test.com',
                firstName: 'Data',
                lastName: 'Test',
                roleIds: ['admin'],
            });
            await userRepository.save(user);

            const query = new GetUserByIdQuery(DEFAULT_TENANT_ID, user.id.toString());
            const result = await queryBus.execute(query);

            expect(result.user.email.toString()).toBe('datatest@test.com');
            expect(result.user.firstName).toBe('Data');
            expect(result.user.lastName).toBe('Test');
            expect(result.user.roleIds).toContain('admin');
        });
    });

    describe('ListUsersQuery', () => {
        beforeEach(async () => {
            // Seed some users
            const users = [
                createTestUser({ email: 'user1@test.com', firstName: 'Alice' }),
                createTestUser({ email: 'user2@test.com', firstName: 'Bob' }),
                createTestUser({ email: 'user3@test.com', firstName: 'Charlie' }),
            ];

            for (const user of users) {
                await userRepository.save(user);
            }
        });

        it('should return all users for tenant', async () => {
            const query = new ListUsersQuery(DEFAULT_TENANT_ID, 1, 10);
            const result = await queryBus.execute(query);

            expect(result).toBeDefined();
            expect(result.users.length).toBeGreaterThanOrEqual(3);
            expect(result.total).toBeGreaterThanOrEqual(3);
        });

        it('should support pagination', async () => {
            const query = new ListUsersQuery(DEFAULT_TENANT_ID, 1, 2);
            const result = await queryBus.execute(query);

            expect(result.users.length).toBeLessThanOrEqual(2);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(2);
        });

        it('should return different users on different pages', async () => {
            const page1Query = new ListUsersQuery(DEFAULT_TENANT_ID, 1, 1);
            const page2Query = new ListUsersQuery(DEFAULT_TENANT_ID, 2, 1);

            const page1Result = await queryBus.execute(page1Query);
            const page2Result = await queryBus.execute(page2Query);

            if (page1Result.users.length > 0 && page2Result.users.length > 0) {
                expect(page1Result.users[0].id.toString()).not.toBe(
                    page2Result.users[0].id.toString(),
                );
            }
        });

        it('should filter by status', async () => {
            // Create an inactive user
            const inactiveUser = createTestUser({ email: 'inactive@test.com' });
            inactiveUser.deactivate();
            await userRepository.save(inactiveUser);

            const query = new ListUsersQuery(DEFAULT_TENANT_ID, 1, 10, UserStatus.ACTIVE);
            const result = await queryBus.execute(query);

            result.users.forEach((user: User) => {
                expect(user.status).toBe(UserStatus.ACTIVE);
            });
        });

        it('should return empty array when no users match', async () => {
            const query = new ListUsersQuery('empty-tenant', 1, 10);
            const result = await queryBus.execute(query);

            expect(result.users).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should enforce multi-tenancy isolation', async () => {
            const tenant2User = createTestUser({
                tenantId: 'different-tenant',
                email: 'tenant2@test.com',
            });
            await userRepository.save(tenant2User);

            // Query for default tenant should not include tenant2 user
            const query = new ListUsersQuery(DEFAULT_TENANT_ID, 1, 100);
            const result = await queryBus.execute(query);

            const tenant2Emails = result.users.filter(
                (u: User) => u.email.toString() === 'tenant2@test.com',
            );
            expect(tenant2Emails).toHaveLength(0);
        });
    });
});
