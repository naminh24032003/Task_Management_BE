import { User, UserStatus } from '../../domain/aggregates/user.aggregate';

/**
 * DTO for user response - used in application layer
 */
export interface UserDto {
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

/**
 * Mapper class for converting between User domain entity and DTOs
 */
export class UserMapper {
  /**
   * Map User domain aggregate to UserDto
   */
  static toDto(user: User): UserDto {
    return {
      id: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      status: user.status,
      roleIds: user.roleIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Map array of User domain aggregates to UserDto array
   */
  static toDtoList(users: User[]): UserDto[] {
    return users.map(user => UserMapper.toDto(user));
  }
}
