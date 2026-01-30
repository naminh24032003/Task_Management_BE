import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByIdQuery } from './get-user-by-id.query';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserNotFoundError } from '../../errors/user-not-found.error';
import { GetUserByIdResult } from '../../types';

export { GetUserByIdResult };

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<GetUserByIdResult> {
    const user = await this.userRepository.findById(query.tenantId, query.userId);

    if (!user) {
      throw new UserNotFoundError(query.userId);
    }

    return { user };
  }
}
