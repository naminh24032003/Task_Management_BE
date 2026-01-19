import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { RegisterUserHandler } from '../../../../src/application/commands/register-user/register-user.handler';
import { RegisterUserCommand } from '../../../../src/application/commands/register-user/register-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { DuplicateEmailError } from '../../../../src/application/errors/duplicate-email.error';
import { UserRegisteredEvent } from '../../../../src/application/integration-events/user-registered.event';
import { User } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { VALID_PASSWORD, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('RegisterUserHandler', () => {
    let handler: RegisterUserHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let eventBus: jest.Mocked<EventBus>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();
        eventBus = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<EventBus>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RegisterUserHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
                { provide: EventBus, useValue: eventBus },
            ],
        }).compile();

        handler = module.get<RegisterUserHandler>(RegisterUserHandler);
    });

    const command = new RegisterUserCommand(
        DEFAULT_TENANT_ID,
        'register@example.com',
        VALID_PASSWORD,
        'First',
        'Last',
        'Display'
    );

    it('should register user successfully (Happy Case)', async () => {
        userRepository.emailExists.mockResolvedValue(false);
        userRepository.save.mockImplementation(async (user) => user);

        const result = await handler.execute(command);

        expect(result.success).toBe(true);
        expect(result.user).toBeInstanceOf(User);
        expect(result.user.email.toString()).toBe('register@example.com');
        expect(userRepository.save).toHaveBeenCalled();
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserRegisteredEvent));
    });

    it('should throw DuplicateEmailError if email exists (Unhappy Case)', async () => {
        userRepository.emailExists.mockResolvedValue(true);

        await expect(handler.execute(command)).rejects.toThrow(DuplicateEmailError);
    });

    it('should propagate save errors (Unhappy Case)', async () => {
        userRepository.emailExists.mockResolvedValue(false);
        userRepository.save.mockRejectedValue(new Error('Save failed'));

        await expect(handler.execute(command)).rejects.toThrow('Save failed');
    });
});
