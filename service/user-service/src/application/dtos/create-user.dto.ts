  import { UserStatus } from '../../domain/aggregates/user.aggregate';

/**
 * DTO for creating a new user (admin operation)
 */
export interface CreateUserDto {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  roleIds?: string[];
  status?: UserStatus;
}

/**
 * DTO for user registration (self-registration)
 */
export interface RegisterUserDto {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
}
