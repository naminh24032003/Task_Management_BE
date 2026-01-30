import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserByEmailQuery } from './get-user-by-email.query';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { GetUserByEmailResult } from '../../types';

export { GetUserByEmailResult };

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserByEmailQuery): Promise<GetUserByEmailResult> {
    const user = await this.userRepository.findByEmail(query.tenantId, query.email);
    return { user };
  }
}
