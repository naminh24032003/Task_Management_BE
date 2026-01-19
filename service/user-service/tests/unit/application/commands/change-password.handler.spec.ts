import { Test, TestingModule } from '@nestjs/testing';
import { ChangePasswordHandler } from '../../../../src/application/commands/change-password/change-password.handler';
import { ChangePasswordCommand } from '../../../../src/application/commands/change-password/change-password.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { UserNotFoundError } from '../../../../src/application/errors/user-not-found.error';
import { PasswordMismatchError } from '../../../../src/domain/errors/password-mismatch.error';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, createReconstitutedUser, VALID_PASSWORD, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('ChangePasswordHandler', () => {
    let handler: ChangePasswordHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChangePasswordHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
            ],
        }).compile();

        handler = module.get<ChangePasswordHandler>(ChangePasswordHandler);
    });

    const tenantId = DEFAULT_TENANT_ID;
    const userId = '507f1f77bcf86cd799439011';
    const currentPassword = VALID_PASSWORD;
    const newPassword = 'NewSecurePass123!';
    const command = new ChangePasswordCommand(tenantId, userId, currentPassword, newPassword);

    it('should change password successfully (Happy Case)', async () => {
        const user = createReconstitutedUser({ id: userId });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const result = await handler.execute(command);

        expect(result).toBe(true);
        expect(user.verifyPassword(newPassword)).toBe(true);
        expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw UserNotFoundError if user doesn\'t exist (Unhappy Case)', async () => {
        userRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow(UserNotFoundError);
    });

    it('should throw PasswordMismatchError if current password is wrong (Unhappy Case)', async () => {
        const user = createReconstitutedUser({ id: userId });
        userRepository.findById.mockResolvedValue(user);

        const wrongCommand = new ChangePasswordCommand(tenantId, userId, 'WrongPass123!', newPassword);

        await expect(handler.execute(wrongCommand)).rejects.toThrow(PasswordMismatchError);
    });
});
