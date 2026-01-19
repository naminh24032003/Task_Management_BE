import { Test, TestingModule } from '@nestjs/testing';
import { GetUserByEmailHandler } from '../../../../src/application/queries/get-user-by-email/get-user-by-email.handler';
import { GetUserByEmailQuery } from '../../../../src/application/queries/get-user-by-email/get-user-by-email.query';
import { IUserRepository, USER_REPOSITORY } from '../../../../src/application/ports/user-repository.port';
import { createMockUserRepository } from '../../../mocks/user-repository.mock';
import { createTestUser, DEFAULT_TENANT_ID } from '../../../factories/user.factory';

describe('GetUserByEmailHandler', () => {
    let handler: GetUserByEmailHandler;
    let userRepository: jest.Mocked<IUserRepository>;

    beforeEach(async () => {
        userRepository = createMockUserRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetUserByEmailHandler,
                { provide: USER_REPOSITORY, useValue: userRepository },
            ],
        }).compile();

        handler = module.get<GetUserByEmailHandler>(GetUserByEmailHandler);
    });

    const tenantId = DEFAULT_TENANT_ID;
    const email = 'test@example.com';
    const query = new GetUserByEmailQuery(tenantId, email);

    it('should return user when found (Happy Case)', async () => {
        const user = createTestUser({ email });
        userRepository.findByEmail.mockResolvedValue(user);

        const result = await handler.execute(query);

        expect(result.user).toBe(user);
        expect(userRepository.findByEmail).toHaveBeenCalledWith(tenantId, email);
    });

    it('should return null when user not found (Happy Case/Empty Result)', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        const result = await handler.execute(query);

        expect(result.user).toBeNull();
    });

    it('should propagate repository errors (Unhappy Case)', async () => {
        userRepository.findByEmail.mockRejectedValue(new Error('DB Error'));

        await expect(handler.execute(query)).rejects.toThrow('DB Error');
    });
});
