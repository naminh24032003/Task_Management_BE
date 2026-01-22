export * from './user-registered.handler';
export * from './user-deleted.handler';
export * from './user-email-changed.handler';
export * from './user-logged-in.handler';

import { UserRegisteredHandler } from './user-registered.handler';
import { UserDeletedHandler } from './user-deleted.handler';
import { UserEmailChangedHandler } from './user-email-changed.handler';
import { UserLoggedInHandler } from './user-logged-in.handler';

export const EventHandlers = [
  UserRegisteredHandler,
  UserDeletedHandler,
  UserEmailChangedHandler,
  UserLoggedInHandler,
];
