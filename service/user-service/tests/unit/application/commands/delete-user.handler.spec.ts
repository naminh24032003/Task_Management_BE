import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { DeleteUserHandler } from '../../../../src/application/commands/delete-user/delete-user.handler';
import { DeleteUserCommand } from '../../../../src/application/commands/delete-user/delete-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { UserDeletedEvent } from '../../../../src/application/integration-events/user-deleted.event';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, createReconstitutedUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('DeleteUserHandler', () => {
    let handler: DeleteUserHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let eventBus: jest.Mocked<EventBus>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();
        eventBus = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<EventBus>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeleteUserHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
                { provide: EventBus, useValue: eventBus },
            ],
        }).compile();

        handler = module.get<DeleteUserHandler>(DeleteUserHandler);
    });

    const tenantId = DEFAULT_TENANT_ID;
    const userId = '507f1f77bcf86cd799439011';
    const command = new DeleteUserCommand(tenantId, userId);

    it('should delete user successfully (Happy Case)', async () => {
        const user = createReconstitutedUser({ id: userId });
        userRepository.findById.mockResolvedValue(user);
        userRepository.delete.mockResolvedValue();

        const result = await handler.execute(command);

        expect(result.success).toBe(true);
        expect(userRepository.delete).toHaveBeenCalledWith(tenantId, userId);
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserDeletedEvent));
    });

    it('should throw error if user not found (Unhappy Case)', async () => {
        userRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });

    it('should propagate database errors (Unhappy Case)', async () => {
        userRepository.findById.mockResolvedValue(createTestUser());
        userRepository.delete.mockRejectedValue(new Error('DB Error'));

        await expect(handler.execute(command)).rejects.toThrow('DB Error');
    });
});
