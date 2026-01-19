// Commands
export * from './register-user/register-user.command';
export * from './register-user/register-user.handler';
export * from './login/login.command';
export * from './login/login.handler';
export * from './google-login/google-login.command';
export * from './google-login/google-login.handler';
export * from './change-password/change-password.command';
export * from './change-password/change-password.handler';
export * from './create-user/create-user.command';
export * from './create-user/create-user.handler';
export * from './update-user/update-user.command';
export * from './update-user/update-user.handler';
export * from './delete-user/delete-user.command';
export * from './delete-user/delete-user.handler';
export * from './change-email/change-email.command';
export * from './change-email/change-email.handler';
export * from './update-user-status/update-user-status.command';
export * from './update-user-status/update-user-status.handler';
export * from './assign-roles/assign-roles.command';
export * from './assign-roles/assign-roles.handler';
export * from './remove-roles/remove-roles.command';
export * from './remove-roles/remove-roles.handler';

// Command Handlers array for registration
import { RegisterUserHandler } from './register-user/register-user.handler';
import { LoginHandler } from './login/login.handler';
import { GoogleLoginHandler } from './google-login/google-login.handler';
import { ChangePasswordHandler } from './change-password/change-password.handler';
import { CreateUserHandler } from './create-user/create-user.handler';
import { UpdateUserHandler } from './update-user/update-user.handler';
import { DeleteUserHandler } from './delete-user/delete-user.handler';
import { ChangeEmailHandler } from './change-email/change-email.handler';
import { UpdateUserStatusHandler } from './update-user-status/update-user-status.handler';
import { AssignRolesHandler } from './assign-roles/assign-roles.handler';
import { RemoveRolesHandler } from './remove-roles/remove-roles.handler';

export const CommandHandlers = [
  RegisterUserHandler,
  LoginHandler,
  GoogleLoginHandler,
  ChangePasswordHandler,
  CreateUserHandler,
  UpdateUserHandler,
  DeleteUserHandler,
  ChangeEmailHandler,
  UpdateUserStatusHandler,
  AssignRolesHandler,
  RemoveRolesHandler,
];
