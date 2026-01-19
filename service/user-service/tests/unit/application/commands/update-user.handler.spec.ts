/**
 * Unit Tests for UpdateUserHandler
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserHandler } from '../../../../src/application/commands/update-user/update-user.handler';
import { UpdateUserCommand } from '../../../../src/application/commands/update-user/update-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createReconstitutedUser } from '../../../factories/user.factory';

describe('UpdateUserHandler', () => {
    let handler: UpdateUserHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateUserHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
            ],
        }).compile();

        handler = module.get<UpdateUserHandler>(UpdateUserHandler);
    });

    const tenantId = 'tenant-123';
    const userId = '507f1f77bcf86cd799439011';

    it('should update user profile fields', async () => {
        const user = createReconstitutedUser({
            id: userId,
            tenantId,
            firstName: 'OldFirst',
            lastName: 'OldLast'
        });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserCommand(tenantId, userId, 'NewFirst', 'NewLast', 'Brand New Name');
        const result = await handler.execute(command);

        expect(user.firstName).toBe('NewFirst');
        expect(user.lastName).toBe('NewLast');
        expect(user.displayName).toBe('Brand New Name');
        expect(userRepository.save).toHaveBeenCalledWith(user);
        expect(result.user).toBe(user);
    });

    it('should update user status if provided', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, status: UserStatus.INACTIVE });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserCommand(tenantId, userId, undefined, undefined, undefined, UserStatus.ACTIVE);
        await handler.execute(command);

        expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('should not update profile if no profile fields provided', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, firstName: 'Stay' });
        const updateProfileSpy = jest.spyOn(user, 'updateProfile');
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new UpdateUserCommand(tenantId, userId, undefined, undefined, undefined, UserStatus.ACTIVE);
        await handler.execute(command);

        expect(updateProfileSpy).not.toHaveBeenCalled();
        expect(user.firstName).toBe('Stay');
    });

    it('should throw error if user not found', async () => {
        userRepository.findById.mockResolvedValue(null);

        const command = new UpdateUserCommand(tenantId, userId, 'Fail');
        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });
});
