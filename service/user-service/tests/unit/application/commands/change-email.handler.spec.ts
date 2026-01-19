import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { ChangeEmailHandler } from '../../../../src/application/commands/change-email/change-email.handler';
import { ChangeEmailCommand } from '../../../../src/application/commands/change-email/change-email.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { UserEmailChangedEvent } from '../../../../src/application/integration-events/user-email-changed.event';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, createReconstitutedUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('ChangeEmailHandler', () => {
    let handler: ChangeEmailHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let eventBus: jest.Mocked<EventBus>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();
        eventBus = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<EventBus>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChangeEmailHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
                { provide: EventBus, useValue: eventBus },
            ],
        }).compile();

        handler = module.get<ChangeEmailHandler>(ChangeEmailHandler);
    });

    const tenantId = DEFAULT_TENANT_ID;
    const userId = '507f1f77bcf86cd799439011';
    const newEmail = 'new@example.com';
    const command = new ChangeEmailCommand(tenantId, userId, newEmail);

    it('should change email successfully (Happy Case)', async () => {
        const user = createReconstitutedUser({ id: userId, email: 'old@example.com' });
        userRepository.findById.mockResolvedValue(user);
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.save.mockResolvedValue(user);

        const result = await handler.execute(command);

        expect(user.email.toString()).toBe(newEmail);
        expect(userRepository.save).toHaveBeenCalledWith(user);
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserEmailChangedEvent));
        expect(result.user).toBe(user);
    });

    it('should throw error if user not found (Unhappy Case)', async () => {
        userRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow('User not found');
    });

    it('should throw error if new email is already in use (Unhappy Case)', async () => {
        const user = createReconstitutedUser({ id: userId });
        const anotherUser = createReconstitutedUser({ id: '507f191e810c19729de860ea', email: newEmail });

        userRepository.findById.mockResolvedValue(user);
        userRepository.findByEmail.mockResolvedValue(anotherUser);

        await expect(handler.execute(command)).rejects.toThrow('Email already in use');
    });

    it('should allow changing email back to the same email (Identity)', async () => {
        const user = createReconstitutedUser({ id: userId, email: newEmail });
        userRepository.findById.mockResolvedValue(user);
        userRepository.findByEmail.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        await handler.execute(command);

        expect(userRepository.save).toHaveBeenCalled();
    });
});
