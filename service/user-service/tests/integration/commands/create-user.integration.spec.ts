/**
 * Integration Tests for CreateUser Command
 * Tests the full flow with NestJS Test Module and mocked infrastructure
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, EventBus, CqrsModule } from '@nestjs/cqrs';
import { CreateUserHandler } from '../../../src/application/commands/create-user/create-user.handler';
import { CreateUserCommand } from '../../../src/application/commands/create-user/create-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../src/domain/aggregates/user.aggregate';
import { UserRegisteredEvent } from '../../../src/application/integration-events/user-registered.event';
import { createInMemoryUserRepository } from '../../mocks/user-repository.mock';
import { VALID_PASSWORD, DEFAULT_TENANT_ID } from '../../factories/user.factory';

describe('CreateUser Integration Tests', () => {
    let module: TestingModule;
    let commandBus: CommandBus;
    let eventBus: EventBus;
    let userRepository: IUserRepository;
    let publishedEvents: any[];

    beforeEach(async () => {
        publishedEvents = [];

        module = await Test.createTestingModule({
            imports: [CqrsModule],
            providers: [
                CreateUserHandler,
                {
                    provide: USER_REPOSITORY,
                    useFactory: createInMemoryUserRepository,
                },
            ],
        }).compile();

        await module.init();

        commandBus = module.get<CommandBus>(CommandBus);
        eventBus = module.get<EventBus>(EventBus);
        userRepository = module.get<IUserRepository>(USER_REPOSITORY);

        // Register command handler
        commandBus.register([CreateUserHandler]);

        // Spy on event publishing
        jest.spyOn(eventBus, 'publish').mockImplementation((event) => {
            publishedEvents.push(event);
        });
    });

    afterEach(async () => {
        await module.close();
    });

    describe('CreateUserCommand flow', () => {
        it('should successfully create a user through the command bus', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'newuser@test.com',
                VALID_PASSWORD,
                'John',
                'Doe',
                'John Doe',
                [],
            );

            const result = await commandBus.execute(command);

            expect(result).toBeDefined();
            expect(result.user).toBeInstanceOf(User);
            expect(result.user.email.toString()).toBe('newuser@test.com');
        });

        it('should persist the user in repository', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'persistent@test.com',
                VALID_PASSWORD,
                'Jane',
                'Smith',
                'Jane Smith',
                [],
            );

            const result = await commandBus.execute(command);

            const persistedUser = await userRepository.findById(
                DEFAULT_TENANT_ID,
                result.user.id.toString(),
            );

            expect(persistedUser).not.toBeNull();
            expect(persistedUser!.email.toString()).toBe('persistent@test.com');
        });

        it('should publish UserRegisteredEvent', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'eventtest@test.com',
                VALID_PASSWORD,
                'Event',
                'Test',
                'Event Test',
                [],
            );

            await commandBus.execute(command);

            expect(publishedEvents).toHaveLength(1);
            expect(publishedEvents[0]).toBeInstanceOf(UserRegisteredEvent);
            expect(publishedEvents[0].email).toBe('eventtest@test.com');
        });

        it('should prevent duplicate email registration', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'duplicate@test.com',
                VALID_PASSWORD,
                'First',
                'User',
                'First User',
                [],
            );

            // First creation should succeed
            await commandBus.execute(command);

            // Second creation with same email should fail
            const duplicateCommand = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'duplicate@test.com',
                VALID_PASSWORD,
                'Second',
                'User',
                'Second User',
                [],
            );

            await expect(commandBus.execute(duplicateCommand)).rejects.toThrow('Email already registered');
        });

        it('should allow same email in different tenants', async () => {
            const command1 = new CreateUserCommand(
                'tenant-1',
                'shared@test.com',
                VALID_PASSWORD,
                'User',
                'One',
                'User One',
                [],
            );

            const command2 = new CreateUserCommand(
                'tenant-2',
                'shared@test.com',
                VALID_PASSWORD,
                'User',
                'Two',
                'User Two',
                [],
            );

            const result1 = await commandBus.execute(command1);
            const result2 = await commandBus.execute(command2);

            expect(result1.user).toBeDefined();
            expect(result2.user).toBeDefined();
            expect(result1.user.id.toString()).not.toBe(result2.user.id.toString());
        });

        it('should assign roles to created user', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'roleuser@test.com',
                VALID_PASSWORD,
                'Role',
                'User',
                'Role User',
                ['admin-role', 'user-role'],
            );

            const result = await commandBus.execute(command);

            expect(result.user.roleIds).toContain('admin-role');
            expect(result.user.roleIds).toContain('user-role');
        });

        it('should create user with ACTIVE status by default', async () => {
            const command = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'activeuser@test.com',
                VALID_PASSWORD,
                'Active',
                'User',
                'Active User',
                [],
            );

            const result = await commandBus.execute(command);

            expect(result.user.status).toBe(UserStatus.ACTIVE);
            expect(result.user.isActive()).toBe(true);
        });

        it('should handle password validation correctly', async () => {
            const commandWithWeakPassword = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'weakpwd@test.com',
                'weak', // Invalid password
                'Weak',
                'Password',
                'Weak Password',
                [],
            );

            await expect(commandBus.execute(commandWithWeakPassword)).rejects.toThrow();
        });

        it('should handle email validation correctly', async () => {
            const commandWithInvalidEmail = new CreateUserCommand(
                DEFAULT_TENANT_ID,
                'invalid-email', // Invalid email
                VALID_PASSWORD,
                'Invalid',
                'Email',
                'Invalid Email',
                [],
            );

            await expect(commandBus.execute(commandWithInvalidEmail)).rejects.toThrow();
        });
    });

    describe('concurrent operations', () => {
        it('should handle concurrent user creation', async () => {
            const commands = Array.from({ length: 5 }, (_, i) =>
                new CreateUserCommand(
                    DEFAULT_TENANT_ID,
                    `concurrent${i}@test.com`,
                    VALID_PASSWORD,
                    `User`,
                    `${i}`,
                    `User ${i}`,
                    [],
                ),
            );

            const results = await Promise.all(commands.map((cmd) => commandBus.execute(cmd)));

            expect(results).toHaveLength(5);
            results.forEach((result, i) => {
                expect(result.user.email.toString()).toBe(`concurrent${i}@test.com`);
            });
        });
    });
});
