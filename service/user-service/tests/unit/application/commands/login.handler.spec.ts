/**
 * Unit Tests for LoginHandler
 * Tests authentication logic with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginHandler, LoginResult, TokenPair } from '../../../../src/application/commands/login/login.handler';
import { LoginCommand } from '../../../../src/application/commands/login/login.command';

jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { User, UserStatus } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import {
    createTestUser,
    createReconstitutedUser,
    createOAuthUser,
    VALID_PASSWORD,
    DEFAULT_TENANT_ID,
} from '../../../factories/user.factory';

describe('LoginHandler', () => {
    let handler: LoginHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let jwtService: jest.Mocked<JwtService>;
    let configService: jest.Mocked<ConfigService>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
        } as unknown as jest.Mocked<JwtService>;

        configService = {
            get: jest.fn((key: string, defaultValue: any) => defaultValue),
            getOrThrow: jest.fn(),
        } as unknown as jest.Mocked<ConfigService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LoginHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
                { provide: JwtService, useValue: jwtService },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        handler = module.get<LoginHandler>(LoginHandler);
    });

    describe('execute', () => {
        const validCommand: LoginCommand = {
            tenantId: DEFAULT_TENANT_ID,
            email: 'test@example.com',
            password: VALID_PASSWORD,
        };

        describe('successful login', () => {
            it('should return user and tokens for valid credentials', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                const result = await handler.execute(validCommand);

                expect(result).toBeDefined();
                expect(result.user).toBeInstanceOf(User);
                expect(result.tokens).toBeDefined();
                expect(result.tokens.accessToken).toBeDefined();
                expect(result.tokens.refreshToken).toBeDefined();
            });

            it('should look up user by email in correct tenant', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                await handler.execute(validCommand);

                expect(userRepository.findByEmail).toHaveBeenCalledWith(
                    DEFAULT_TENANT_ID,
                    'test@example.com',
                );
            });

            it('should record login and save user', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                await handler.execute(validCommand);

                expect(userRepository.save).toHaveBeenCalledWith(expect.any(User));
            });

            it('should generate access and refresh tokens', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                await handler.execute(validCommand);

                expect(jwtService.sign).toHaveBeenCalledTimes(2);
            });

            it('should include user data in token payload', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                await handler.execute(validCommand);

                expect(jwtService.sign).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sub: user.id.toString(),
                        tenantId: user.tenantId,
                        email: user.email.toString(),
                        type: 'access',
                    }),
                    expect.any(Object),
                );
            });

            it('should return tokens with expiresIn', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                const result = await handler.execute(validCommand);

                expect(result.tokens.expiresIn).toBeDefined();
                expect(typeof result.tokens.expiresIn).toBe('number');
            });
        });

        describe('authentication failures', () => {
            it('should throw UnauthorizedException if user not found', async () => {
                userRepository.findByEmail.mockResolvedValue(null);

                await expect(handler.execute(validCommand)).rejects.toThrow(UnauthorizedException);
                await expect(handler.execute(validCommand)).rejects.toThrow('Invalid email or password');
            });

            it('should throw ForbiddenException if user is not active', async () => {
                const inactiveUser = createReconstitutedUser({ status: UserStatus.INACTIVE });
                userRepository.findByEmail.mockResolvedValue(inactiveUser);

                await expect(handler.execute(validCommand)).rejects.toThrow(ForbiddenException);
                await expect(handler.execute(validCommand)).rejects.toThrow('Account is not active');
            });

            it('should throw ForbiddenException if user is suspended', async () => {
                const suspendedUser = createReconstitutedUser({ status: UserStatus.SUSPENDED });
                userRepository.findByEmail.mockResolvedValue(suspendedUser);

                await expect(handler.execute(validCommand)).rejects.toThrow(ForbiddenException);
            });

            it('should throw UnauthorizedException for OAuth user trying password login', async () => {
                const oauthUser = createOAuthUser();
                userRepository.findByEmail.mockResolvedValue(oauthUser);

                await expect(handler.execute(validCommand)).rejects.toThrow(UnauthorizedException);
                await expect(handler.execute(validCommand)).rejects.toThrow('OAuth provider');
            });

            it('should throw UnauthorizedException for wrong password', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);

                const wrongPasswordCommand: LoginCommand = {
                    ...validCommand,
                    password: 'WrongPassword123!',
                };

                await expect(handler.execute(wrongPasswordCommand)).rejects.toThrow(UnauthorizedException);
                await expect(handler.execute(wrongPasswordCommand)).rejects.toThrow('Invalid email or password');
            });
        });

        describe('token configuration', () => {
            it('should use configured access token expiration', async () => {
                configService.get.mockImplementation((key: string, defaultValue: any) => {
                    if (key === 'JWT_ACCESS_EXPIRES_IN') return 7200;
                    return defaultValue;
                });

                // Recreate handler with new config
                const handlerWithConfig = new LoginHandler(userRepository, jwtService, configService);
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                const result = await handlerWithConfig.execute(validCommand);

                expect(result.tokens.expiresIn).toBe(7200);
            });

            it('should use default expiration if not configured', async () => {
                const user = createTestUser();
                userRepository.findByEmail.mockResolvedValue(user);
                userRepository.save.mockImplementation(async (u) => u);

                const result = await handler.execute(validCommand);

                expect(result.tokens.expiresIn).toBe(3600); // Default value
            });
        });

        describe('security checks', () => {
            it('should not save user if authentication fails', async () => {
                userRepository.findByEmail.mockResolvedValue(null);

                try {
                    await handler.execute(validCommand);
                } catch {
                    // Expected
                }

                expect(userRepository.save).not.toHaveBeenCalled();
            });

            it('should not generate tokens if authentication fails', async () => {
                userRepository.findByEmail.mockResolvedValue(null);

                try {
                    await handler.execute(validCommand);
                } catch {
                    // Expected
                }

                expect(jwtService.sign).not.toHaveBeenCalled();
            });
        });
    });
});
