/**
 * Unit Tests for CreateUserHandler
 * Tests command handling with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { CreateUserHandler, CreateUserResult } from '../../../../src/application/commands/create-user/create-user.handler';
import { CreateUserCommand } from '../../../../src/application/commands/create-user/create-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { UserRegisteredEvent } from '../../../../src/application/integration-events/user-registered.event';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, VALID_PASSWORD, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('CreateUserHandler', () => {
    let handler: CreateUserHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let eventBus: jest.Mocked<EventBus>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();
        eventBus = {
            publish: jest.fn(),
            publishAll: jest.fn(),
        } as unknown as jest.Mocked<EventBus>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateUserHandler,
                {
                    provide: USER_REPOSITORY,
                    useValue: userRepository,
                },
                {
                    provide: EventBus,
                    useValue: eventBus,
                },
            ],
        }).compile();

        handler = module.get<CreateUserHandler>(CreateUserHandler);
    });

    describe('execute', () => {
        const validCommand: CreateUserCommand = {
            tenantId: DEFAULT_TENANT_ID,
            email: 'newuser@example.com',
            password: VALID_PASSWORD,
            firstName: 'John',
            lastName: 'Doe',
            displayName: 'John Doe',
            roleIds: [],
        };

        it('should create a new user successfully', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            const result = await handler.execute(validCommand);

            expect(result).toBeDefined();
            expect(result.user).toBeInstanceOf(User);
            expect(result.user.email.toString()).toBe('newuser@example.com');
            expect(result.user.firstName).toBe('John');
            expect(result.user.lastName).toBe('Doe');
            expect(result.user.status).toBe(UserStatus.ACTIVE);
        });

        it('should check for existing email', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            await handler.execute(validCommand);

            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                validCommand.tenantId,
                validCommand.email,
            );
        });

        it('should throw error if email already exists', async () => {
            const existingUser = createTestUser({ email: 'newuser@example.com' });
            userRepository.findByEmail.mockResolvedValue(existingUser);

            await expect(handler.execute(validCommand)).rejects.toThrow('Email already registered');
        });

        it('should save the created user', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            await handler.execute(validCommand);

            expect(userRepository.save).toHaveBeenCalledTimes(1);
            expect(userRepository.save).toHaveBeenCalledWith(expect.any(User));
        });

        it('should publish UserRegisteredEvent', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            await handler.execute(validCommand);

            expect(eventBus.publish).toHaveBeenCalledTimes(1);
            expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserRegisteredEvent));
        });

        it('should include correct data in UserRegisteredEvent', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            await handler.execute(validCommand);

            const publishedEvent = eventBus.publish.mock.calls[0][0] as UserRegisteredEvent;
            expect(publishedEvent.email).toBe('newuser@example.com');
            expect(publishedEvent.firstName).toBe('John');
            expect(publishedEvent.lastName).toBe('Doe');
        });

        it('should return the saved user', async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.save.mockImplementation(async (user) => user);

            const result = await handler.execute(validCommand);

            expect(result.user).toBeDefined();
            expect(result.user.email.toString()).toBe('newuser@example.com');
        });

        describe('with status override', () => {
            it('should create inactive user when status is INACTIVE', async () => {
                const commandWithStatus: CreateUserCommand = {
                    ...validCommand,
                    status: UserStatus.INACTIVE,
                };
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockImplementation(async (user) => user);

                const result = await handler.execute(commandWithStatus);

                expect(result.user.status).toBe(UserStatus.INACTIVE);
            });

            it('should create suspended user when status is SUSPENDED', async () => {
                const commandWithStatus: CreateUserCommand = {
                    ...validCommand,
                    status: UserStatus.SUSPENDED,
                };
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockImplementation(async (user) => user);

                const result = await handler.execute(commandWithStatus);

                expect(result.user.status).toBe(UserStatus.SUSPENDED);
            });

            it('should create active user when status is ACTIVE', async () => {
                const commandWithStatus: CreateUserCommand = {
                    ...validCommand,
                    status: UserStatus.ACTIVE,
                };
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockImplementation(async (user) => user);

                const result = await handler.execute(commandWithStatus);

                expect(result.user.status).toBe(UserStatus.ACTIVE);
            });
        });

        describe('with roleIds', () => {
            it('should assign roles to created user', async () => {
                const commandWithRoles: CreateUserCommand = {
                    ...validCommand,
                    roleIds: ['role-1', 'role-2'],
                };
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockImplementation(async (user) => user);

                const result = await handler.execute(commandWithRoles);

                expect(result.user.roleIds).toEqual(['role-1', 'role-2']);
            });
        });

        describe('error handling', () => {
            it('should propagate repository errors', async () => {
                userRepository.findByEmail.mockRejectedValue(new Error('Database error'));

                await expect(handler.execute(validCommand)).rejects.toThrow('Database error');
            });

            it('should propagate save errors', async () => {
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockRejectedValue(new Error('Save failed'));

                await expect(handler.execute(validCommand)).rejects.toThrow('Save failed');
            });

            it('should not publish event if save fails', async () => {
                userRepository.findByEmail.mockResolvedValue(null);
                userRepository.save.mockRejectedValue(new Error('Save failed'));

                try {
                    await handler.execute(validCommand);
                } catch {
                    // Expected to throw
                }

                expect(eventBus.publish).not.toHaveBeenCalled();
            });
        });
    });
});
