/**
 * Integration Tests for UserAuthenticationService
 * Tests the authentication flow with token generation and validation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserAuthenticationService } from '../../../src/application/services/user-authentication.service';
import { IUserRepository, USER_REPOSITORY } from '../../../src/application/ports/user-repository.port';

jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));
import { User, UserStatus } from '../../../src/domain/aggregates/user.aggregate';
import { createInMemoryUserRepository } from '../../mocks/user-repository.mock';
import {
    createTestUser,
    createReconstitutedUser,
    createOAuthUser,
    VALID_PASSWORD,
    DEFAULT_TENANT_ID,
} from '../../factories/user.factory';

describe('UserAuthenticationService Integration', () => {
    let module: TestingModule;
    let authService: UserAuthenticationService;
    let userRepository: IUserRepository;
    let jwtService: JwtService;

    const JWT_SECRET = 'test-jwt-secret-for-testing';

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [
                        () => ({
                            JWT_SECRET,
                            JWT_ACCESS_EXPIRES_IN: 3600,
                            JWT_REFRESH_EXPIRES_IN: 604800,
                        }),
                    ],
                }),
                JwtModule.register({
                    secret: JWT_SECRET,
                    signOptions: { expiresIn: '1h' },
                }),
            ],
            providers: [
                UserAuthenticationService,
                {
                    provide: USER_REPOSITORY,
                    useFactory: createInMemoryUserRepository,
                },
            ],
        }).compile();

        await module.init();

        authService = module.get<UserAuthenticationService>(UserAuthenticationService);
        userRepository = module.get<IUserRepository>(USER_REPOSITORY);
        jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(async () => {
        await module.close();
    });

    describe('login', () => {
        it('should successfully login with valid credentials', async () => {
            const user = createTestUser({ email: 'login@test.com' });
            await userRepository.save(user);

            const result = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'login@test.com',
                password: VALID_PASSWORD,
            });

            expect(result).toBeDefined();
            expect(result.user).toBeInstanceOf(User);
            expect(result.tokens.accessToken).toBeDefined();
            expect(result.tokens.refreshToken).toBeDefined();
            expect(result.tokens.expiresIn).toBeDefined();
        });

        it('should generate valid JWT access token', async () => {
            const user = createTestUser({ email: 'jwttest@test.com' });
            await userRepository.save(user);

            const result = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'jwttest@test.com',
                password: VALID_PASSWORD,
            });

            const decoded = jwtService.decode(result.tokens.accessToken) as any;
            expect(decoded.sub).toBe(user.id.toString());
            expect(decoded.email).toBe('jwttest@test.com');
            expect(decoded.tenantId).toBe(DEFAULT_TENANT_ID);
            expect(decoded.type).toBe('access');
        });

        it('should generate valid JWT refresh token', async () => {
            const user = createTestUser({ email: 'refreshtest@test.com' });
            await userRepository.save(user);

            const result = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'refreshtest@test.com',
                password: VALID_PASSWORD,
            });

            const decoded = jwtService.decode(result.tokens.refreshToken) as any;
            expect(decoded.type).toBe('refresh');
            expect(decoded.jti).toBeDefined();
        });

        it('should update lastLoginAt after login', async () => {
            const user = createTestUser({ email: 'lastlogin@test.com' });
            await userRepository.save(user);

            const beforeLogin = new Date();
            await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'lastlogin@test.com',
                password: VALID_PASSWORD,
            });

            const updatedUser = await userRepository.findByEmail(DEFAULT_TENANT_ID, 'lastlogin@test.com');
            expect(updatedUser!.lastLoginAt).toBeDefined();
            expect(updatedUser!.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
        });

        it('should throw UnauthorizedException for non-existent user', async () => {
            await expect(
                authService.login({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'nonexistent@test.com',
                    password: VALID_PASSWORD,
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for wrong password', async () => {
            const user = createTestUser({ email: 'wrongpwd@test.com' });
            await userRepository.save(user);

            await expect(
                authService.login({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'wrongpwd@test.com',
                    password: 'WrongPassword123!',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException for inactive user', async () => {
            const user = createTestUser({ email: 'inactive@test.com' });
            user.deactivate();
            await userRepository.save(user);

            await expect(
                authService.login({
                    tenantId: DEFAULT_TENANT_ID,
                    email: 'inactive@test.com',
                    password: VALID_PASSWORD,
                }),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('validateToken', () => {
        it('should validate a valid access token', async () => {
            const user = createTestUser({ email: 'validate@test.com' });
            await userRepository.save(user);

            const loginResult = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'validate@test.com',
                password: VALID_PASSWORD,
            });

            const validationResult = await authService.validateToken(loginResult.tokens.accessToken);

            expect(validationResult.valid).toBe(true);
            expect(validationResult.userId).toBe(user.id.toString());
            expect(validationResult.tenantId).toBe(DEFAULT_TENANT_ID);
        });

        it('should return invalid for expired token', async () => {
            // Create an expired token manually
            const expiredToken = jwtService.sign(
                { sub: 'user-id', type: 'access' },
                { expiresIn: '-1h' },
            );

            const result = await authService.validateToken(expiredToken);

            expect(result.valid).toBe(false);
        });

        it('should return invalid for refresh token used as access token', async () => {
            const user = createTestUser({ email: 'refreshasaccess@test.com' });
            await userRepository.save(user);

            const loginResult = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'refreshasaccess@test.com',
                password: VALID_PASSWORD,
            });

            const result = await authService.validateToken(loginResult.tokens.refreshToken);

            expect(result.valid).toBe(false);
        });

        it('should return invalid for malformed token', async () => {
            const result = await authService.validateToken('invalid-token');

            expect(result.valid).toBe(false);
        });
    });

    describe('refreshToken', () => {
        it('should refresh tokens with valid refresh token', async () => {
            const user = createTestUser({ email: 'refresh@test.com' });
            await userRepository.save(user);

            const loginResult = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'refresh@test.com',
                password: VALID_PASSWORD,
            });

            const refreshResult = await authService.refreshToken(loginResult.tokens.refreshToken);

            expect(refreshResult).toBeDefined();
            expect(refreshResult.accessToken).toBeDefined();
            expect(refreshResult.refreshToken).toBeDefined();
            expect(refreshResult.accessToken).not.toBe(loginResult.tokens.accessToken);
        });

        it('should invalidate old refresh token after refresh', async () => {
            const user = createTestUser({ email: 'invalidateold@test.com' });
            await userRepository.save(user);

            const loginResult = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'invalidateold@test.com',
                password: VALID_PASSWORD,
            });

            // First refresh should work
            await authService.refreshToken(loginResult.tokens.refreshToken);

            // Second refresh with same token should fail
            await expect(authService.refreshToken(loginResult.tokens.refreshToken)).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException for invalid refresh token', async () => {
            await expect(authService.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('logout', () => {
        it('should invalidate refresh token on logout', async () => {
            const user = createTestUser({ email: 'logout@test.com' });
            await userRepository.save(user);

            const loginResult = await authService.login({
                tenantId: DEFAULT_TENANT_ID,
                email: 'logout@test.com',
                password: VALID_PASSWORD,
            });

            const logoutSuccess = await authService.logout(loginResult.tokens.refreshToken);
            expect(logoutSuccess).toBe(true);

            // Refresh should fail after logout
            await expect(authService.refreshToken(loginResult.tokens.refreshToken)).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should return false for invalid token on logout', async () => {
            const result = await authService.logout('invalid-token');

            expect(result).toBe(false);
        });
    });

    describe('multi-tenancy', () => {
        it('should enforce tenant isolation in login', async () => {
            const user = createTestUser({ tenantId: 'tenant-a', email: 'tenanttest@test.com' });
            await userRepository.save(user);

            // Login with wrong tenant should fail
            await expect(
                authService.login({
                    tenantId: 'tenant-b',
                    email: 'tenanttest@test.com',
                    password: VALID_PASSWORD,
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should include tenant ID in generated tokens', async () => {
            const user = createTestUser({ tenantId: 'specific-tenant', email: 'tenanttoken@test.com' });
            await userRepository.save(user);

            const result = await authService.login({
                tenantId: 'specific-tenant',
                email: 'tenanttoken@test.com',
                password: VALID_PASSWORD,
            });

            const decoded = jwtService.decode(result.tokens.accessToken) as any;
            expect(decoded.tenantId).toBe('specific-tenant');
        });
    });
});
