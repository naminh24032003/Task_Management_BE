import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByIdQuery } from './get-user-by-id.query';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserNotFoundError } from '../../errors/user-not-found.error';
import { GetUserByIdResult } from '../../types';
export { GetUserByIdResult };
import { AUTH_CACHE_SERVICE, IAuthCacheService } from '../../ports/auth-cache.port';
import { User, UserStatus } from '../../../domain/aggregates/user.aggregate';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(AUTH_CACHE_SERVICE)
    private readonly cacheService: IAuthCacheService,
  ) { }

  async execute(query: GetUserByIdQuery): Promise<GetUserByIdResult> {
    // Tier 1 & 2: Check Cache (L1: NearCache, L2: Redis)
    const cachedProfile = await this.cacheService.getUserProfile(query.tenantId, query.userId);
    if (cachedProfile) {
      // Reconstitute domain object from cached data
      const user = User.reconstitute({
        id: cachedProfile.userId,
        tenantId: cachedProfile.tenantId,
        email: cachedProfile.email,
        firstName: cachedProfile.firstName || '',
        lastName: cachedProfile.lastName || '',
        displayName: cachedProfile.displayName,
        roleIds: cachedProfile.roleIds,
        status: UserStatus.ACTIVE,
        passwordHash: '', // Not needed for profile display
        passwordSalt: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { user };
    }

    // Tier 3: Source of truth (MongoDB)
    const user = await this.userRepository.findById(query.tenantId, query.userId);

    if (!user) {
      throw new UserNotFoundError(query.userId);
    }

    // Populate Cache for future requests
    await this.cacheService.cacheUserProfile(query.tenantId, query.userId, {
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      roleIds: user.roleIds,
    });

    return { user };
  }
}
