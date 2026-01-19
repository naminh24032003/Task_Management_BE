/**
 * Unit Tests for GetUserByIdHandler
 * Tests query handling with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GetUserByIdHandler, GetUserByIdResult } from '../../../../src/application/queries/get-user-by-id/get-user-by-id.handler';
import { GetUserByIdQuery } from '../../../../src/application/queries/get-user-by-id/get-user-by-id.query';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User } from '../../../../src/domain/aggregates/user.aggregate';
import { UserNotFoundError } from '../../../../src/application/errors/user-not-found.error';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('GetUserByIdHandler', () => {
    let handler: GetUserByIdHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetUserByIdHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
            ],
        }).compile();

        handler = module.get<GetUserByIdHandler>(GetUserByIdHandler);
    });

    describe('execute', () => {
        const userId = '507f1f77bcf86cd799439011';

        it('should return user when found', async () => {
            const user = createTestUser();
            userRepository.findById.mockResolvedValue(user);

            const query: GetUserByIdQuery = {
                tenantId: DEFAULT_TENANT_ID,
                userId: user.id.toString(),
            };

            const result = await handler.execute(query);

            expect(result).toBeDefined();
            expect(result.user).toBeInstanceOf(User);
            expect(result.user).toBe(user);
        });

        it('should call repository with correct tenant and user ID', async () => {
            const user = createTestUser();
            userRepository.findById.mockResolvedValue(user);

            const query: GetUserByIdQuery = {
                tenantId: 'tenant-abc',
                userId: userId,
            };

            await handler.execute(query);

            expect(userRepository.findById).toHaveBeenCalledWith('tenant-abc', userId);
        });

        it('should throw UserNotFoundError when user does not exist', async () => {
            userRepository.findById.mockResolvedValue(null);

            const query: GetUserByIdQuery = {
                tenantId: DEFAULT_TENANT_ID,
                userId: 'non-existent-id',
            };

            await expect(handler.execute(query)).rejects.toThrow(UserNotFoundError);
        });

        it('should include user ID in error message', async () => {
            userRepository.findById.mockResolvedValue(null);

            const query: GetUserByIdQuery = {
                tenantId: DEFAULT_TENANT_ID,
                userId: 'specific-user-id',
            };

            try {
                await handler.execute(query);
                fail('Should have thrown');
            } catch (error) {
                expect((error as UserNotFoundError).message).toContain('specific-user-id');
            }
        });

        it('should propagate repository errors', async () => {
            userRepository.findById.mockRejectedValue(new Error('Database connection failed'));

            const query: GetUserByIdQuery = {
                tenantId: DEFAULT_TENANT_ID,
                userId: userId,
            };

            await expect(handler.execute(query)).rejects.toThrow('Database connection failed');
        });
    });
});
