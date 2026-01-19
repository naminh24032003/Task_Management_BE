import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { GoogleLoginHandler } from '../../../../src/application/commands/google-login/google-login.handler';
import { GoogleLoginCommand } from '../../../../src/application/commands/google-login/google-login.command';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { UserRegisteredEvent } from '../../../../src/application/integration-events/user-registered.event';
import { User } from '../../../../src/domain/aggregates/user.aggregate';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

// Mock OAuth2Client
jest.mock('google-auth-library', () => {
    return {
        OAuth2Client: jest.fn().mockImplementation(() => {
            return {
                verifyIdToken: jest.fn(),
            };
        }),
    };
});

describe('GoogleLoginHandler', () => {
    let handler: GoogleLoginHandler;
    let userRepository: jest.Mocked<IUserRepository>;
    let configService: jest.Mocked<ConfigService>;
    let eventBus: jest.Mocked<EventBus>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();
        eventBus = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<EventBus>;

        configService = {
            get: jest.fn().mockReturnValue({ google: { clientId: 'mock-client-id' } }),
        } as unknown as jest.Mocked<ConfigService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleLoginHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
                { provide: ConfigService, useValue: configService },
                { provide: EventBus, useValue: eventBus },
            ],
        }).compile();

        handler = module.get<GoogleLoginHandler>(GoogleLoginHandler);
    });

    const idToken = 'mock-id-token';
    const tenantId = DEFAULT_TENANT_ID;
    const command = new GoogleLoginCommand(tenantId, idToken);

    it('should login existing user (Happy Case)', async () => {
        const user = createTestUser({ email: 'google@test.com' });
        userRepository.findByEmail.mockResolvedValue(user);
        userRepository.save.mockResolvedValue(user);

        // Mock verifyIdToken
        (handler as any).oauthClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({
                email: 'google@test.com',
                given_name: 'John',
                family_name: 'Doe',
                sub: 'google-123',
            }),
        });

        const result = await handler.execute(command);

        expect(result.isNewUser).toBe(false);
        expect(result.user).toBe(user);
        expect(userRepository.save).toHaveBeenCalled();
    });

    it('should create and login new user (Happy Case)', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.save.mockImplementation(async (u) => u);

        (handler as any).oauthClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({
                email: 'new-google@test.com',
                given_name: 'New',
                family_name: 'User',
                sub: 'google-456',
            }),
        });

        const result = await handler.execute(command);

        expect(result.isNewUser).toBe(true);
        expect(result.user.email.toString()).toBe('new-google@test.com');
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserRegisteredEvent));
    });

    it('should throw error for invalid token (Unhappy Case)', async () => {
        (handler as any).oauthClient.verifyIdToken.mockResolvedValue({
            getPayload: () => null,
        });

        await expect(handler.execute(command)).rejects.toThrow('Invalid Google ID token');
    });

    it('should propagate verify errors (Unhappy Case)', async () => {
        (handler as any).oauthClient.verifyIdToken.mockRejectedValue(new Error('Google Auth Error'));

        await expect(handler.execute(command)).rejects.toThrow('Google Auth Error');
    });
});
