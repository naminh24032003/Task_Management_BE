/**
 * Contract Tests for UserController (gRPC UserService)
 * 
 * These tests verify that the UserController correctly:
 * 1. Transforms gRPC requests to domain commands/queries
 * 2. Extracts required metadata (tenant ID, user ID)
 * 3. Returns properly formatted gRPC responses
 * 4. Handles errors and returns appropriate RPC exceptions
 * 
 * Contract tests focus on the API contract, not internal implementation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RpcException } from '@nestjs/microservices';
import { UserController } from '../../../src/infrastructure/grpc/user.controller';
import { User, UserStatus as DomainUserStatus } from '../../../src/domain/aggregates/user.aggregate';
import { UserStatus } from '../../../src/generated/user/v1/user';
import { createDefaultMetadata, createAuthenticatedMetadata, createEmptyMetadata } from '../../mocks/metadata.mock';
import { createTestUser, createTestUsers, DEFAULT_TENANT_ID } from '../../factories/user.factory';

// Mock UUID for deterministic IDs
jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));

describe('UserController Contract Tests', () => {
    let controller: UserController;
    let commandBus: jest.Mocked<CommandBus>;
    let queryBus: jest.Mocked<QueryBus>;

    beforeEach(async () => {
        commandBus = {
            execute: jest.fn(),
        } as unknown as jest.Mocked<CommandBus>;

        queryBus = {
            execute: jest.fn(),
        } as unknown as jest.Mocked<QueryBus>;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                { provide: CommandBus, useValue: commandBus },
                { provide: QueryBus, useValue: queryBus },
            ],
        }).compile();

        controller = module.get<UserController>(UserController);
    });

    describe('Contract: GetUser', () => {
        const testUser = createTestUser({ email: 'getuser@example.com' });

        it('should accept GetUserRequest and return GetUserResponse', async () => {
            queryBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.getUser({ userId: testUser.id.toString() }, metadata);

            expect(response).toHaveProperty('user');
            expect(response.user).toBeDefined();
        });

        it('should return user with all required fields in response', async () => {
            queryBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.getUser({ userId: testUser.id.toString() }, metadata);

            // Verify response contract fields
            expect(response.user).toHaveProperty('id');
            expect(response.user).toHaveProperty('tenantId');
            expect(response.user).toHaveProperty('email');
            expect(response.user).toHaveProperty('firstName');
            expect(response.user).toHaveProperty('lastName');
            expect(response.user).toHaveProperty('displayName');
            expect(response.user).toHaveProperty('status');
            expect(response.user).toHaveProperty('roleIds');
            expect(response.user).toHaveProperty('createdAt');
            expect(response.user).toHaveProperty('updatedAt');
        });

        it('should require x-tenant-id metadata header', async () => {
            const emptyMetadata = createEmptyMetadata();

            await expect(
                controller.getUser({ userId: 'any-id' }, emptyMetadata),
            ).rejects.toThrow(RpcException);
        });

        it('should throw RpcException with NOT_FOUND for non-existent user', async () => {
            queryBus.execute.mockRejectedValue(new Error('User not found'));
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await expect(
                controller.getUser({ userId: 'non-existent-id' }, metadata),
            ).rejects.toThrow(RpcException);
        });

        it('should map domain UserStatus to proto UserStatus correctly', async () => {
            const activeUser = createTestUser({ email: 'active@example.com' });
            queryBus.execute.mockResolvedValue({ user: activeUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.getUser({ userId: activeUser.id.toString() }, metadata);

            expect(response.user?.status).toBe(UserStatus.USER_STATUS_ACTIVE);
        });
    });

    describe('Contract: GetMe', () => {
        const testUser = createTestUser({ email: 'me@example.com' });

        it('should accept GetMeRequest and return GetMeResponse', async () => {
            queryBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createAuthenticatedMetadata(DEFAULT_TENANT_ID, testUser.id.toString());

            const response = await controller.getMe({}, metadata);

            expect(response).toHaveProperty('user');
            expect(response.user).toBeDefined();
        });

        it('should require x-user-id metadata header', async () => {
            const metadataWithoutUserId = createDefaultMetadata(DEFAULT_TENANT_ID);

            await expect(
                controller.getMe({}, metadataWithoutUserId),
            ).rejects.toThrow(RpcException);
        });

        it('should require x-tenant-id metadata header', async () => {
            const emptyMetadata = createEmptyMetadata();

            await expect(
                controller.getMe({}, emptyMetadata),
            ).rejects.toThrow(RpcException);
        });
    });

    describe('Contract: CreateUser', () => {
        const createUserRequest = {
            email: 'newuser@example.com',
            password: 'SecurePass123!',
            firstName: 'New',
            lastName: 'User',
            displayName: 'New User',
            roleIds: ['role-1'],
            status: UserStatus.USER_STATUS_ACTIVE,
        };

        it('should accept CreateUserRequest and return CreateUserResponse', async () => {
            const createdUser = createTestUser({ email: 'newuser@example.com' });
            commandBus.execute.mockResolvedValue({ user: createdUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.createUser(createUserRequest, metadata);

            expect(response).toHaveProperty('user');
            expect(response.user).toBeDefined();
        });

        it('should pass all request fields to the command', async () => {
            const createdUser = createTestUser({ email: 'newuser@example.com' });
            commandBus.execute.mockResolvedValue({ user: createdUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.createUser(createUserRequest, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'newuser@example.com',
                    password: 'SecurePass123!',
                    firstName: 'New',
                    lastName: 'User',
                    displayName: 'New User',
                    roleIds: ['role-1'],
                }),
            );
        });

        it('should require x-tenant-id metadata header', async () => {
            const emptyMetadata = createEmptyMetadata();

            await expect(
                controller.createUser(createUserRequest, emptyMetadata),
            ).rejects.toThrow(RpcException);
        });

        it('should return created user with all fields populated', async () => {
            const createdUser = createTestUser({ email: 'newuser@example.com' });
            commandBus.execute.mockResolvedValue({ user: createdUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.createUser(createUserRequest, metadata);

            expect(response.user?.id).toBeDefined();
            expect(response.user?.email).toBe('newuser@example.com');
            expect(response.user?.tenantId).toBe(DEFAULT_TENANT_ID);
        });
    });

    describe('Contract: UpdateUser', () => {
        const testUser = createTestUser({ email: 'update@example.com' });
        const updateRequest = {
            userId: testUser.id.toString(),
            firstName: 'Updated',
            lastName: 'Name',
            displayName: 'Updated Name',
        };

        it('should accept UpdateUserRequest and return UpdateUserResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.updateUser(updateRequest, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should pass userId and update fields to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.updateUser(updateRequest, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    userId: testUser.id.toString(),
                    firstName: 'Updated',
                    lastName: 'Name',
                    displayName: 'Updated Name',
                }),
            );
        });

        it('should handle optional status field', async () => {
            const updateWithStatus = {
                ...updateRequest,
                status: UserStatus.USER_STATUS_INACTIVE,
            };
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.updateUser(updateWithStatus, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: DomainUserStatus.INACTIVE,
                }),
            );
        });
    });

    describe('Contract: ListUsers', () => {
        const testUsers = createTestUsers(3);

        it('should accept ListUsersRequest and return ListUsersResponse', async () => {
            queryBus.execute.mockResolvedValue({ users: testUsers, total: 3 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.listUsers({ page: 1, pageSize: 10 }, metadata);

            expect(response).toHaveProperty('users');
            expect(response).toHaveProperty('total');
            expect(response).toHaveProperty('page');
            expect(response).toHaveProperty('pageSize');
        });

        it('should return array of users', async () => {
            queryBus.execute.mockResolvedValue({ users: testUsers, total: 3 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.listUsers({ page: 1, pageSize: 10 }, metadata);

            expect(Array.isArray(response.users)).toBe(true);
            expect(response.users.length).toBe(3);
        });

        it('should support pagination parameters', async () => {
            queryBus.execute.mockResolvedValue({ users: testUsers.slice(0, 2), total: 3 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.listUsers({ page: 1, pageSize: 2 }, metadata);

            expect(response.page).toBe(1);
            expect(response.pageSize).toBe(2);
        });

        it('should default page to 1 and pageSize to 10', async () => {
            queryBus.execute.mockResolvedValue({ users: [], total: 0 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.listUsers({ page: 0, pageSize: 0 }, metadata);

            expect(response.page).toBe(1);
            expect(response.pageSize).toBe(10);
        });

        it('should support status filter', async () => {
            queryBus.execute.mockResolvedValue({ users: [], total: 0 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.listUsers({ page: 1, pageSize: 10, statusFilter: UserStatus.USER_STATUS_ACTIVE }, metadata);

            expect(queryBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: DomainUserStatus.ACTIVE,
                }),
            );
        });

        it('should support search parameter', async () => {
            queryBus.execute.mockResolvedValue({ users: [], total: 0 });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.listUsers({ page: 1, pageSize: 10, search: 'john' }, metadata);

            expect(queryBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'john',
                }),
            );
        });
    });

    describe('Contract: DeleteUser', () => {
        it('should accept DeleteUserRequest and return DeleteUserResponse', async () => {
            commandBus.execute.mockResolvedValue({ success: true });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.deleteUser({ userId: 'user-123' }, metadata);

            expect(response).toHaveProperty('success');
            expect(response.success).toBe(true);
        });

        it('should pass userId to the command', async () => {
            commandBus.execute.mockResolvedValue({ success: true });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.deleteUser({ userId: 'user-to-delete' }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    userId: 'user-to-delete',
                }),
            );
        });
    });

    describe('Contract: ChangePassword', () => {
        it('should accept ChangePasswordRequest and return ChangePasswordResponse', async () => {
            commandBus.execute.mockResolvedValue({ success: true });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.changePassword({
                userId: 'user-123',
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass123!',
            }, metadata);

            expect(response).toHaveProperty('success');
            expect(response.success).toBe(true);
        });

        it('should pass all password fields to the command', async () => {
            commandBus.execute.mockResolvedValue({ success: true });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.changePassword({
                userId: 'user-123',
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass123!',
            }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    userId: 'user-123',
                    currentPassword: 'OldPass123!',
                    newPassword: 'NewPass123!',
                }),
            );
        });
    });

    describe('Contract: GetUserByEmail', () => {
        const testUser = createTestUser({ email: 'byemail@example.com' });

        it('should accept GetUserByEmailRequest and return GetUserByEmailResponse', async () => {
            queryBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.getUserByEmail({ email: 'byemail@example.com' }, metadata);

            expect(response).toHaveProperty('user');
            expect(response.user?.email).toBe('byemail@example.com');
        });

        it('should throw RpcException with NOT_FOUND when user not found', async () => {
            queryBus.execute.mockResolvedValue({ user: null });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await expect(
                controller.getUserByEmail({ email: 'notfound@example.com' }, metadata),
            ).rejects.toThrow(RpcException);
        });
    });

    describe('Contract: ChangeEmail', () => {
        const testUser = createTestUser({ email: 'newemail@example.com' });

        it('should accept ChangeEmailRequest and return ChangeEmailResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.changeEmail({
                userId: 'user-123',
                newEmail: 'newemail@example.com',
            }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should pass userId and newEmail to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.changeEmail({
                userId: 'user-123',
                newEmail: 'newemail@example.com',
            }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    userId: 'user-123',
                    newEmail: 'newemail@example.com',
                }),
            );
        });
    });

    describe('Contract: ActivateUser', () => {
        const testUser = createTestUser({ email: 'activate@example.com' });

        it('should accept ActivateUserRequest and return ActivateUserResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.activateUser({ userId: 'user-123' }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should send ACTIVE status to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.activateUser({ userId: 'user-123' }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: DomainUserStatus.ACTIVE,
                }),
            );
        });
    });

    describe('Contract: DeactivateUser', () => {
        const testUser = createTestUser({ email: 'deactivate@example.com' });

        it('should accept DeactivateUserRequest and return DeactivateUserResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.deactivateUser({ userId: 'user-123' }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should send INACTIVE status to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.deactivateUser({ userId: 'user-123' }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: DomainUserStatus.INACTIVE,
                }),
            );
        });
    });

    describe('Contract: SuspendUser', () => {
        const testUser = createTestUser({ email: 'suspend@example.com' });

        it('should accept SuspendUserRequest and return SuspendUserResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.suspendUser({ userId: 'user-123' }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should send SUSPENDED status to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.suspendUser({ userId: 'user-123' }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: DomainUserStatus.SUSPENDED,
                }),
            );
        });
    });

    describe('Contract: AssignRoles', () => {
        const testUser = createTestUser({ email: 'assignroles@example.com' });

        it('should accept AssignRolesRequest and return AssignRolesResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.assignRoles({
                userId: 'user-123',
                roleIds: ['role-1', 'role-2'],
            }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should pass roleIds array to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.assignRoles({
                userId: 'user-123',
                roleIds: ['role-1', 'role-2'],
            }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    roleIds: ['role-1', 'role-2'],
                }),
            );
        });
    });

    describe('Contract: RemoveRoles', () => {
        const testUser = createTestUser({ email: 'removeroles@example.com' });

        it('should accept RemoveRolesRequest and return RemoveRolesResponse', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            const response = await controller.removeRoles({
                userId: 'user-123',
                roleIds: ['role-1'],
            }, metadata);

            expect(response).toHaveProperty('user');
        });

        it('should pass roleIds array to the command', async () => {
            commandBus.execute.mockResolvedValue({ user: testUser });
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await controller.removeRoles({
                userId: 'user-123',
                roleIds: ['role-1'],
            }, metadata);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    roleIds: ['role-1'],
                }),
            );
        });
    });

    describe('Error Handling Contract', () => {
        it('should wrap all errors in RpcException', async () => {
            queryBus.execute.mockRejectedValue(new Error('Internal error'));
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            await expect(
                controller.getUser({ userId: 'any-id' }, metadata),
            ).rejects.toThrow(RpcException);
        });

        it('should preserve error messages in RpcException', async () => {
            queryBus.execute.mockRejectedValue(new Error('Custom error message'));
            const metadata = createDefaultMetadata(DEFAULT_TENANT_ID);

            try {
                await controller.getUser({ userId: 'any-id' }, metadata);
            } catch (error) {
                expect(error).toBeInstanceOf(RpcException);
                expect((error as RpcException).getError()).toMatchObject({
                    message: 'Custom error message',
                });
            }
        });
    });
});
