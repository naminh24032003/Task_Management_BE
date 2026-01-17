import { UserStatus } from '../../domain/aggregates/user.aggregate';

/**
 * DTO for updating user profile
 */
export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  status?: UserStatus;
}

/**
 * DTO for changing user email
 */
export interface ChangeEmailDto {
  newEmail: string;
}

/**
 * DTO for changing user password
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * DTO for assigning/removing roles
 */
export interface ManageRolesDto {
  roleIds: string[];
}
