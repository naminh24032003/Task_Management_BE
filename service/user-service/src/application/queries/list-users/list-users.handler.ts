import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListUsersQuery } from './list-users.query';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { ListUsersResult } from '../../types';

export { ListUsersResult };

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: ListUsersQuery): Promise<ListUsersResult> {
    const result = await this.userRepository.findAll(query.tenantId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      search: query.search,
    });

    return {
      users: result.users,
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
