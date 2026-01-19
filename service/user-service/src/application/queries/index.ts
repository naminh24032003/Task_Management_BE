// Queries
export * from './get-user-by-id/get-user-by-id.query';
export * from './get-user-by-id/get-user-by-id.handler';
export * from './get-user-by-email/get-user-by-email.query';
export * from './get-user-by-email/get-user-by-email.handler';
export * from './list-users/list-users.query';
export * from './list-users/list-users.handler';

// Query Handlers array for registration
import { GetUserByIdHandler } from './get-user-by-id/get-user-by-id.handler';
import { GetUserByEmailHandler } from './get-user-by-email/get-user-by-email.handler';
import { ListUsersHandler } from './list-users/list-users.handler';

export const QueryHandlers = [
  GetUserByIdHandler,
  GetUserByEmailHandler,
  ListUsersHandler,
];
