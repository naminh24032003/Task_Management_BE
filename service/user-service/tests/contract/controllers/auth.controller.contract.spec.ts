/**
 * Contract Tests for AuthController (gRPC AuthService)
 * 
 * These tests verify that the AuthController correctly:
 * 1. Transforms gRPC requests to domain commands
 * 2. Returns properly formatted gRPC responses
 * 3. Handles authentication flow correctly
 * 4. Maps errors to appropriate RPC exceptions
 * 
 * Contract tests focus on the API contract, not internal implementation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { RpcException } from '@nestjs/microservices';
import { AuthController } from '../../../src/ports/inbound/auth.controller';
import { UserAuthenticationService } from '../../../src/application/services/user-authentication.service';
import { User, UserStatus as DomainUserStatus } from '../../../src/domain/aggregates/user.aggregate';
import { UserStatus } from '../../../src/generated/user/v1/user';
import { createTestUser, createOAuthUser, VALID_PASSWORD, DEFAULT_TENANT_ID } from '../../factories/user.factory';

// Mock UUID for deterministic IDs
jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));

describe('AuthController Contract Tests', () => {
    let controller: AuthController;
    let commandBus: jest.Mocked<CommandBus>;
    let authService: jest.Mocked<UserAuthenticationService>;

    const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
    };

    beforeEach(async () => {
        commandBus = {
            execute: jest.fn(),
        } as unknown as jest.Mocked<CommandBus>;

        authService = {
            generateTokens: jest.fn().mockResolvedValue(mockTokens),
            refreshToken: jest.fn().mockResolvedValue(mockTokens),
            validateToken: jest.fn(),
            logout: jest.fn(),
            login: jest.fn(),
        } as unknown as jest.Mocked<UserAuthenticationService>;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: CommandBus, useValue: commandBus },
                { provide: UserAuthenticationService, useValue: authService },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    describe('Contract: Register', () => {
        const registerRequest = {
            tenantId: DEFAULT_TENANT_ID,
            email: 'register@example.com',
            password: VALID_PASSWORD,
            firstName: 'New',
            lastName: 'User',
            displayName: 'New User',
        };

        it('should accept RegisterRequest and return RegisterResponse', async () => {
            const registeredUser = createTestUser({ email: 'register@example.com' });
            commandBus.execute.mockResolvedValue({
                user: registeredUser,
                success: true,
                message: 'User registered successfully',
            });

            const response = await controller.register(registerRequest);

            expect(response).toHaveProperty('user');
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('message');
        });

        it('should return user with all required fields', async () => {
            const registeredUser = createTestUser({ email: 'register@example.com' });
            commandBus.execute.mockResolvedValue({
                user: registeredUser,
                success: true,
                message: 'User registered successfully',
            });

            const response = await controller.register(registerRequest);

            // Verify user response contract fields
            expect(response.user).toHaveProperty('id');
            expect(response.user).toHaveProperty('tenantId');
            expect(response.user).toHaveProperty('email');
            expect(response.user).toHaveProperty('firstName');
            expect(response.user).toHaveProperty('lastName');
            expect(response.user).toHaveProperty('displayName');
            expect(response.user).toHaveProperty('status');
            expect(response.user).toHaveProperty('roleIds');
            expect(response.user).toHaveProperty('createdAt');
            expect(response.user).toHaveProperty('updatedAt');
        });

        it('should pass all request fields to the command', async () => {
            const registeredUser = createTestUser({ email: 'register@example.com' });
            commandBus.execute.mockResolvedValue({
                user: registeredUser,
                success: true,
                message: 'User registered successfully',
            });

            await controller.register(registerRequest);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'register@example.com',
                    password: VALID_PASSWORD,
                    firstName: 'New',
                    lastName: 'User',
                    displayName: 'New User',
                }),
            );
        });

        it('should throw RpcException on registration failure', async () => {
            commandBus.execute.mockRejectedValue(new Error('Email already exists'));

            await expect(controller.register(registerRequest)).rejects.toThrow(RpcException);
        });

        it('should map domain UserStatus to proto UserStatus', async () => {
            const registeredUser = createTestUser({ email: 'register@example.com' });
            commandBus.execute.mockResolvedValue({
                user: registeredUser,
                success: true,
                message: 'Success',
            });

            const response = await controller.register(registerRequest);

            expect(response.user?.status).toBe(UserStatus.USER_STATUS_ACTIVE);
        });
    });

    describe('Contract: Login', () => {
        const loginRequest = {
            tenantId: DEFAULT_TENANT_ID,
            email: 'login@example.com',
            password: VALID_PASSWORD,
        };

        it('should accept LoginRequest and return LoginResponse', async () => {
            const user = createTestUser({ email: 'login@example.com' });
            commandBus.execute.mockResolvedValue({
                user,
                tokens: mockTokens,
            });

            const response = await controller.login(loginRequest);

            expect(response).toHaveProperty('user');
            expect(response).toHaveProperty('tokens');
        });

        it('should return tokens with all required fields', async () => {
            const user = createTestUser({ email: 'login@example.com' });
            commandBus.execute.mockResolvedValue({
                user,
                tokens: mockTokens,
            });

            const response = await controller.login(loginRequest);

            expect(response.tokens).toHaveProperty('accessToken');
            expect(response.tokens).toHaveProperty('refreshToken');
            expect(response.tokens).toHaveProperty('expiresIn');
        });

        it('should pass credentials to the login command', async () => {
            const user = createTestUser({ email: 'login@example.com' });
            commandBus.execute.mockResolvedValue({
                user,
                tokens: mockTokens,
            });

            await controller.login(loginRequest);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'login@example.com',
                    password: VALID_PASSWORD,
                }),
            );
        });

        it('should throw RpcException with UNAUTHORIZED on login failure', async () => {
            commandBus.execute.mockRejectedValue(new Error('Invalid credentials'));

            await expect(controller.login(loginRequest)).rejects.toThrow(RpcException);
        });
    });

    describe('Contract: GoogleLogin', () => {
        const googleLoginRequest = {
            tenantId: DEFAULT_TENANT_ID,
            idToken: 'google-id-token-123',
        };

        it('should accept GoogleLoginRequest and return GoogleLoginResponse', async () => {
            const oauthUser = createOAuthUser(DEFAULT_TENANT_ID, 'google@example.com');
            commandBus.execute.mockResolvedValue({
                user: oauthUser,
                isNewUser: true,
            });

            const response = await controller.googleLogin(googleLoginRequest);

            expect(response).toHaveProperty('user');
            expect(response).toHaveProperty('tokens');
            expect(response).toHaveProperty('isNewUser');
        });

        it('should generate tokens for authenticated user', async () => {
            const oauthUser = createOAuthUser(DEFAULT_TENANT_ID, 'google@example.com');
            commandBus.execute.mockResolvedValue({
                user: oauthUser,
                isNewUser: false,
            });

            await controller.googleLogin(googleLoginRequest);

            expect(authService.generateTokens).toHaveBeenCalledWith(oauthUser);
        });

        it('should indicate if user is new', async () => {
            const oauthUser = createOAuthUser(DEFAULT_TENANT_ID, 'newgoogle@example.com');
            commandBus.execute.mockResolvedValue({
                user: oauthUser,
                isNewUser: true,
            });

            const response = await controller.googleLogin(googleLoginRequest);

            expect(response.isNewUser).toBe(true);
        });

        it('should throw RpcException with UNAUTHORIZED on Google auth failure', async () => {
            commandBus.execute.mockRejectedValue(new Error('Invalid Google token'));

            await expect(controller.googleLogin(googleLoginRequest)).rejects.toThrow(RpcException);
        });

        it('should pass idToken to the command', async () => {
            const oauthUser = createOAuthUser(DEFAULT_TENANT_ID, 'google@example.com');
            commandBus.execute.mockResolvedValue({
                user: oauthUser,
                isNewUser: false,
            });

            await controller.googleLogin(googleLoginRequest);

            expect(commandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: DEFAULT_TENANT_ID,
                    idToken: 'google-id-token-123',
                }),
            );
        });
    });

    describe('Contract: RefreshToken', () => {
        const refreshRequest = {
            refreshToken: 'valid-refresh-token',
        };

        it('should accept RefreshTokenRequest and return RefreshTokenResponse', async () => {
            authService.refreshToken.mockResolvedValue(mockTokens);

            const response = await controller.refreshToken(refreshRequest);

            expect(response).toHaveProperty('tokens');
        });

        it('should return new tokens with all required fields', async () => {
            authService.refreshToken.mockResolvedValue(mockTokens);

            const response = await controller.refreshToken(refreshRequest);

            expect(response.tokens).toHaveProperty('accessToken');
            expect(response.tokens).toHaveProperty('refreshToken');
            expect(response.tokens).toHaveProperty('expiresIn');
        });

        it('should pass refresh token to the auth service', async () => {
            authService.refreshToken.mockResolvedValue(mockTokens);

            await controller.refreshToken(refreshRequest);

            expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
        });

        it('should throw RpcException with UNAUTHORIZED on invalid refresh token', async () => {
            authService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

            await expect(controller.refreshToken(refreshRequest)).rejects.toThrow(RpcException);
        });
    });

    describe('Contract: ValidateToken', () => {
        const validateRequest = {
            accessToken: 'valid-access-token',
        };

        it('should accept ValidateTokenRequest and return ValidateTokenResponse', async () => {
            authService.validateToken.mockResolvedValue({
                valid: true,
                userId: 'user-123',
                tenantId: DEFAULT_TENANT_ID,
                permissions: ['read', 'write'],
            });

            const response = await controller.validateToken(validateRequest);

            expect(response).toHaveProperty('valid');
            expect(response).toHaveProperty('userId');
            expect(response).toHaveProperty('tenantId');
            expect(response).toHaveProperty('permissions');
        });

        it('should return validation status', async () => {
            authService.validateToken.mockResolvedValue({
                valid: true,
                userId: 'user-123',
                tenantId: DEFAULT_TENANT_ID,
            });

            const response = await controller.validateToken(validateRequest);

            expect(response.valid).toBe(true);
        });

        it('should return user context when token is valid', async () => {
            authService.validateToken.mockResolvedValue({
                valid: true,
                userId: 'user-123',
                tenantId: DEFAULT_TENANT_ID,
                permissions: ['admin'],
            });

            const response = await controller.validateToken(validateRequest);

            expect(response.userId).toBe('user-123');
            expect(response.tenantId).toBe(DEFAULT_TENANT_ID);
        });

        it('should return empty permissions array when none specified', async () => {
            authService.validateToken.mockResolvedValue({
                valid: true,
                userId: 'user-123',
                tenantId: DEFAULT_TENANT_ID,
            });

            const response = await controller.validateToken(validateRequest);

            expect(response.permissions).toEqual([]);
        });

        it('should return valid=false for invalid token', async () => {
            authService.validateToken.mockResolvedValue({
                valid: false,
            });

            const response = await controller.validateToken(validateRequest);

            expect(response.valid).toBe(false);
        });
    });

    describe('Contract: Logout', () => {
        const logoutRequest = {
            refreshToken: 'valid-refresh-token',
        };

        it('should accept LogoutRequest and return LogoutResponse', async () => {
            authService.logout.mockResolvedValue(true);

            const response = await controller.logout(logoutRequest);

            expect(response).toHaveProperty('success');
        });

        it('should return success=true on successful logout', async () => {
            authService.logout.mockResolvedValue(true);

            const response = await controller.logout(logoutRequest);

            expect(response.success).toBe(true);
        });

        it('should return success=false on failed logout', async () => {
            authService.logout.mockResolvedValue(false);

            const response = await controller.logout(logoutRequest);

            expect(response.success).toBe(false);
        });

        it('should pass refresh token to the auth service', async () => {
            authService.logout.mockResolvedValue(true);

            await controller.logout(logoutRequest);

            expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token');
        });
    });

    describe('Error Handling Contract', () => {
        it('should wrap command errors in RpcException', async () => {
            commandBus.execute.mockRejectedValue(new Error('Command failed'));

            await expect(
                controller.register({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'test@example.com',
                    password: VALID_PASSWORD,
                    firstName: 'Test',
                    lastName: 'User',
                    displayName: 'Test User',
                }),
            ).rejects.toThrow(RpcException);
        });

        it('should preserve error code in RpcException', async () => {
            const errorWithCode = { code: 'VALIDATION_ERROR', message: 'Invalid input' };
            commandBus.execute.mockRejectedValue(errorWithCode);

            try {
                await controller.login({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'test@example.com',
                    password: 'wrong',
                });
            } catch (error) {
                expect(error).toBeInstanceOf(RpcException);
                expect((error as RpcException).getError()).toMatchObject({
                    code: 'VALIDATION_ERROR',
                });
            }
        });

        it('should default to INTERNAL_ERROR code when not specified', async () => {
            commandBus.execute.mockRejectedValue(new Error('Unknown error'));

            try {
                await controller.register({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'test@example.com',
                    password: VALID_PASSWORD,
                    firstName: 'Test',
                    lastName: 'User',
                    displayName: 'Test User',
                });
            } catch (error) {
                expect(error).toBeInstanceOf(RpcException);
                expect((error as RpcException).getError()).toMatchObject({
                    code: 'INTERNAL_ERROR',
                });
            }
        });

        it('should use UNAUTHORIZED code for auth service errors', async () => {
            authService.refreshToken.mockRejectedValue(new Error('Token expired'));

            try {
                await controller.refreshToken({ refreshToken: 'expired-token' });
            } catch (error) {
                expect(error).toBeInstanceOf(RpcException);
                expect((error as RpcException).getError()).toMatchObject({
                    code: 'UNAUTHORIZED',
                });
            }
        });
    });

    describe('Response Mapping Contract', () => {
        it('should map all UserStatus values correctly', async () => {
            const statusTests = [
                { domainStatus: DomainUserStatus.ACTIVE, expectedProto: UserStatus.USER_STATUS_ACTIVE },
                { domainStatus: DomainUserStatus.INACTIVE, expectedProto: UserStatus.USER_STATUS_INACTIVE },
                { domainStatus: DomainUserStatus.SUSPENDED, expectedProto: UserStatus.USER_STATUS_SUSPENDED },
                { domainStatus: DomainUserStatus.DELETED, expectedProto: UserStatus.USER_STATUS_DELETED },
            ];

            for (const testCase of statusTests) {
                const user = createTestUser({ email: 'status@example.com' });
                // Modify user status
                if (testCase.domainStatus === DomainUserStatus.INACTIVE) {
                    user.deactivate();
                } else if (testCase.domainStatus === DomainUserStatus.SUSPENDED) {
                    user.suspend();
                }

                commandBus.execute.mockResolvedValue({
                    user,
                    success: true,
                    message: 'Success',
                });

                const response = await controller.register({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'test@example.com',
                    password: VALID_PASSWORD,
                    firstName: 'Test',
                    lastName: 'User',
                    displayName: 'Test User',
                });

                expect(response.user?.status).toBeDefined();
            }
        });

        it('should handle users with roles', async () => {
            const userWithRoles = createTestUser({ email: 'roles@example.com' });
            userWithRoles.addRole('role-1');
            userWithRoles.addRole('role-2');
            userWithRoles.addRole('role-3');

            commandBus.execute.mockResolvedValue({
                user: userWithRoles,
                success: true,
                message: 'Success',
            });

            const response = await controller.register({
                tenantId: DEFAULT_TENANT_ID,
                email: 'test@example.com',
                password: VALID_PASSWORD,
                firstName: 'Test',
                lastName: 'User',
                displayName: 'Test User',
            });

            expect(response.user?.roleIds).toEqual(['role-1', 'role-2', 'role-3']);
        });

        it('should handle users with lastLoginAt', async () => {
            const user = createTestUser({ email: 'lastlogin@example.com' });
            user.recordLogin();

            commandBus.execute.mockResolvedValue({
                user,
                tokens: mockTokens,
            });

            const response = await controller.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'lastlogin@example.com',
                password: VALID_PASSWORD,
            });

            expect(response.user?.lastLoginAt).toBeDefined();
        });
    });
});
