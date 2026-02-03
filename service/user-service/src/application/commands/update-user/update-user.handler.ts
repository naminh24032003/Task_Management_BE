import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateUserCommand } from './update-user.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { IAuthCacheService, AUTH_CACHE_SERVICE } from '../../ports/auth-cache.port';
import { IEventPublisher, EVENT_PUBLISHER } from '../../ports/event-publisher.port';
import { UserStatus } from '../../../domain/aggregates/user.aggregate';
import { UpdateUserResult } from '../../types';

export { UpdateUserResult };

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUTH_CACHE_SERVICE) private readonly authCache: IAuthCacheService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) { }

  async execute(command: UpdateUserCommand): Promise<UpdateUserResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (command.firstName || command.lastName || command.displayName) {
      user.updateProfile({
        firstName: command.firstName,
        lastName: command.lastName,
        displayName: command.displayName,
      });
    }

    if (command.status) {
      switch (command.status) {
        case UserStatus.ACTIVE:
          user.activate();
          break;
        case UserStatus.INACTIVE:
          user.deactivate();
          break;
        case UserStatus.SUSPENDED:
          user.suspend();
          break;
        case UserStatus.DELETED:
          user.delete();
          break;
      }
    }

    // 1. Write to DB
    const savedUser = await this.userRepository.save(user);

    // 2. Publish event to Kafka
    await this.eventPublisher.publishUserEvent('user.updated', {
      userId: command.userId,
      tenantId: command.tenantId,
      changes: {
        firstName: command.firstName,
        lastName: command.lastName,
        displayName: command.displayName,
        status: command.status,
      },
    });

    // 3. Invalidate caches (Near + Redis) - Profile changes need cache invalidation
    await Promise.all([
      this.authCache.invalidateRoles(command.tenantId, command.userId),
      this.authCache.invalidatePermissions(command.tenantId, command.userId),
    ]);

    return { user: savedUser };
  }
}
