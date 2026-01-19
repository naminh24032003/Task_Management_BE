import { Test, TestingModule } from '@nestjs/testing';
import { RemoveRolesHandler } from '../../../../src/application/commands/remove-roles/remove-roles.handler';
import { RemoveRolesCommand } from '../../../../src/application/commands/remove-roles/remove-roles.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createReconstitutedUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('RemoveRolesHandler', () => {
    let handler: RemoveRolesHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RemoveRolesHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
            ],
        }).compile();

        handler = module.get<RemoveRolesHandler>(RemoveRolesHandler);
    });

    const tenantId = DEFAULT_TENANT_ID;
    const userId = '507f1f77bcf86cd799439011';
    const command = new RemoveRolesCommand(tenantId, userId, ['role-1', 'role-2']);

    it('should remove roles successfully (Happy Case)', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, roleIds: ['role-1', 'role-2', 'role-3'] });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const result = await handler.execute(command);

        expect(user.roleIds).toEqual(['role-3']);
        expect(userRepository.save).toHaveBeenCalledWith(user);
        expect(result.user).toBe(user);
    });

    it('should throw error if user not found (Unhappy Case)', async () => {
        userRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });

    it('should handle removing non-existent roles (Identity)', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, roleIds: ['role-3'] });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        await handler.execute(command);

        expect(user.roleIds).toEqual(['role-3']);
        expect(userRepository.save).toHaveBeenCalled();
    });
});
