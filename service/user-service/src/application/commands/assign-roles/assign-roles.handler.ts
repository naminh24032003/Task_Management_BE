import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignRolesCommand } from './assign-roles.command';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { IAuthCacheService, AUTH_CACHE_SERVICE } from '../../ports/auth-cache.port';
import { IEventPublisher, EVENT_PUBLISHER } from '../../ports/event-publisher.port';
import { AssignRolesResult } from '../../types';

export { AssignRolesResult };

@CommandHandler(AssignRolesCommand)
export class AssignRolesHandler implements ICommandHandler<AssignRolesCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUTH_CACHE_SERVICE) private readonly authCache: IAuthCacheService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) { }

  async execute(command: AssignRolesCommand): Promise<AssignRolesResult> {
    const user = await this.userRepository.findById(command.tenantId, command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    for (const roleId of command.roleIds) {
      user.addRole(roleId);
    }

    // 1. Write to DB
    const savedUser = await this.userRepository.save(user);

    // 2. Publish event to Kafka
    await this.eventPublisher.publishUserEvent('user.roles.assigned', {
      userId: command.userId,
      tenantId: command.tenantId,
      roleIds: command.roleIds,
    });

    // 3. Invalidate caches (Near + Redis)
    await Promise.all([
      this.authCache.invalidateRoles(command.tenantId, command.userId),
      this.authCache.invalidatePermissions(command.tenantId, command.userId),
    ]);

    return { user: savedUser };
  }
}
