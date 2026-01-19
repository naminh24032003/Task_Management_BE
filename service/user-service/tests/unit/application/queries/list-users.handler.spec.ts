/**
 * Unit Tests for ListUsersHandler
 * Tests query handling with pagination and filtering
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ListUsersHandler, ListUsersResult } from '../../../../src/application/queries/list-users/list-users.handler';
import { ListUsersQuery } from '../../../../src/application/queries/list-users/list-users.query';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUsers, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('ListUsersHandler', () => {
    let handler: ListUsersHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListUsersHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
            ],
        }).compile();

        handler = module.get<ListUsersHandler>(ListUsersHandler);
    });

    describe('execute', () => {
        it('should return paginated users', async () => {
            const users = createTestUsers(5);
            userRepository.findAll.mockResolvedValue({ users, total: 5 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 1,
                pageSize: 10,
            };

            const result = await handler.execute(query);

            expect(result).toBeDefined();
            expect(result.users).toHaveLength(5);
            expect(result.total).toBe(5);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
        });

        it('should pass pagination parameters to repository', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 0 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 2,
                pageSize: 20,
            };

            await handler.execute(query);

            expect(userRepository.findAll).toHaveBeenCalledWith(DEFAULT_TENANT_ID, {
                page: 2,
                pageSize: 20,
                status: undefined,
                search: undefined,
            });
        });

        it('should pass status filter to repository', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 0 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 1,
                pageSize: 10,
                status: UserStatus.ACTIVE,
            };

            await handler.execute(query);

            expect(userRepository.findAll).toHaveBeenCalledWith(
                DEFAULT_TENANT_ID,
                expect.objectContaining({
                    status: UserStatus.ACTIVE,
                }),
            );
        });

        it('should pass search filter to repository', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 0 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 1,
                pageSize: 10,
                search: 'john',
            };

            await handler.execute(query);

            expect(userRepository.findAll).toHaveBeenCalledWith(
                DEFAULT_TENANT_ID,
                expect.objectContaining({
                    search: 'john',
                }),
            );
        });

        it('should return empty array when no users found', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 0 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 1,
                pageSize: 10,
            };

            const result = await handler.execute(query);

            expect(result.users).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should use tenant ID for isolation', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 0 });

            const query: ListUsersQuery = {
                tenantId: 'specific-tenant',
                page: 1,
                pageSize: 10,
            };

            await handler.execute(query);

            expect(userRepository.findAll).toHaveBeenCalledWith('specific-tenant', expect.any(Object));
        });

        it('should propagate repository errors', async () => {
            userRepository.findAll.mockRejectedValue(new Error('Query failed'));

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 1,
                pageSize: 10,
            };

            await expect(handler.execute(query)).rejects.toThrow('Query failed');
        });

        it('should return correct page and pageSize in result', async () => {
            userRepository.findAll.mockResolvedValue({ users: [], total: 100 });

            const query: ListUsersQuery = {
                tenantId: DEFAULT_TENANT_ID,
                page: 5,
                pageSize: 25,
            };

            const result = await handler.execute(query);

            expect(result.page).toBe(5);
            expect(result.pageSize).toBe(25);
        });
    });
});
