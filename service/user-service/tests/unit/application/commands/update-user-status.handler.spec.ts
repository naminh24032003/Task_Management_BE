/**
 * Unit Tests for UpdateUserStatusHandler
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserStatusHandler } from '../../../../src/application/commands/update-user-status/update-user-status.handler';
import { UpdateUserStatusCommand } from '../../../../src/application/commands/update-user-status/update-user-status.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createReconstitutedUser } from '../../../factories/user.factory';

describe('UpdateUserStatusHandler', () => {
    let handler: UpdateUserStatusHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateUserStatusHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
            ],
        }).compile();

        handler = module.get<UpdateUserStatusHandler>(UpdateUserStatusHandler);
    });

    const tenantId = 'tenant-123';
    const userId = '507f1f77bcf86cd799439011';

    it('should activate user successfully', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, status: UserStatus.INACTIVE });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.ACTIVE);
        const result = await handler.execute(command);

        expect(user.status).toBe(UserStatus.ACTIVE);
        expect(userRepository.save).toHaveBeenCalledWith(user);
        expect(result.user).toBe(user);
    });

    it('should deactivate user successfully', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, status: UserStatus.ACTIVE });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.INACTIVE);
        await handler.execute(command);

        expect(user.status).toBe(UserStatus.INACTIVE);
    });

    it('should suspend user successfully', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, status: UserStatus.ACTIVE });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.SUSPENDED);
        await handler.execute(command);

        expect(user.status).toBe(UserStatus.SUSPENDED);
    });

    it('should soft delete user successfully', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, status: UserStatus.ACTIVE });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.DELETED);
        await handler.execute(command);

        expect(user.status).toBe(UserStatus.DELETED);
    });

    it('should throw error if user not found', async () => {
        userRepository.findById.mockResolvedValue(null);

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.ACTIVE);
        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });

    it('should propagate repository errors', async () => {
        userRepository.findById.mockRejectedValue(new Error('DB Error'));

        const command = new UpdateUserStatusCommand(tenantId, userId, UserStatus.ACTIVE);
        await expect(handler.execute(command)).rejects.toThrow('DB Error');
    });
});
