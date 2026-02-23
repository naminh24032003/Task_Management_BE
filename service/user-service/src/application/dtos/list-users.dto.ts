import { UserStatus } from '../../domain/aggregates/user.aggregate';

/**
 * DTO for listing users with pagination and filters
 */
export interface ListUsersDto {
  page: number;
  pageSize: number;
  status?: UserStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

/**
 * DTO for paginated user list response
 */
export interface PaginatedUsersDto {
  users: UserResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * DTO for user response
 */
export interface UserResponseDto {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: UserStatus;
  roleIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
