/**
 * Unit Tests for AssignRolesHandler
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AssignRolesHandler } from '../../../../src/application/commands/assign-roles/assign-roles.handler';
import { AssignRolesCommand } from '../../../../src/application/commands/assign-roles/assign-roles.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createReconstitutedUser } from '../../../factories/user.factory';

describe('AssignRolesHandler', () => {
    let handler: AssignRolesHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AssignRolesHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
            ],
        }).compile();

        handler = module.get<AssignRolesHandler>(AssignRolesHandler);
    });

    const tenantId = 'tenant-123';
    const userId = '507f1f77bcf86cd799439011';

    it('should assign multiple roles to user', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, roleIds: ['role-1'] });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new AssignRolesCommand(tenantId, userId, ['role-2', 'role-3']);
        const result = await handler.execute(command);

        expect(user.roleIds).toContain('role-1');
        expect(user.roleIds).toContain('role-2');
        expect(user.roleIds).toContain('role-3');
        expect(user.roleIds.length).toBe(3);
        expect(userRepository.save).toHaveBeenCalledWith(user);
        expect(result.user).toBe(user);
    });

    it('should not add duplicate roles', async () => {
        const user = createReconstitutedUser({ id: userId, tenantId, roleIds: ['role-1'] });
        userRepository.findById.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        const command = new AssignRolesCommand(tenantId, userId, ['role-1', 'role-2']);
        await handler.execute(command);

        expect(user.roleIds).toContain('role-1');
        expect(user.roleIds).toContain('role-2');
        expect(user.roleIds.length).toBe(2);
    });

    it('should throw error if user not found', async () => {
        userRepository.findById.mockResolvedValue(null);

        const command = new AssignRolesCommand(tenantId, userId, ['role-1']);
        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });
});
