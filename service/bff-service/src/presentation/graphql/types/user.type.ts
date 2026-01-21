import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

export enum UserStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  SUSPENDED = 3,
  DELETED = 4,
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'User account status',
});

@ObjectType({ description: 'User entity' })
export class User {
  @Field(() => ID, { description: 'User unique identifier' })
  id: string;

  @Field({ description: 'Tenant identifier' })
  tenantId: string;

  @Field({ description: 'User email address' })
  email: string;

  @Field({ description: 'User first name' })
  firstName: string;

  @Field({ description: 'User last name' })
  lastName: string;

  @Field({ nullable: true, description: 'User display name' })
  displayName?: string;

  @Field(() => UserStatus, { description: 'User account status' })
  status: UserStatus;

  @Field(() => [String], { description: 'User role identifiers' })
  roleIds: string[];

  @Field({ description: 'Account creation timestamp' })
  createdAt: string;

  @Field({ description: 'Last update timestamp' })
  updatedAt: string;

  @Field({ nullable: true, description: 'Last login timestamp' })
  lastLoginAt?: string;
}

@ObjectType({ description: 'JWT token pair' })
export class TokenPair {
  @Field({ description: 'Access token for authentication' })
  accessToken: string;

  @Field({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken: string;

  @Field(() => Int, { description: 'Access token expiration time in seconds' })
  expiresIn: number;
}

@ObjectType({ description: 'Authentication response payload' })
export class AuthPayload {
  @Field(() => User, { description: 'Authenticated user' })
  user: User;

  @Field(() => TokenPair, { nullable: true, description: 'JWT tokens' })
  tokens?: TokenPair;

  @Field({ nullable: true, description: 'Operation success status' })
  success?: boolean;

  @Field({ nullable: true, description: 'Response message' })
  message?: string;

  @Field({ nullable: true, description: 'Indicates if user was newly created (for OAuth)' })
  isNewUser?: boolean;
}

@ObjectType({ description: 'Paginated user list response' })
export class UserConnection {
  @Field(() => [User], { description: 'List of users' })
  users: User[];

  @Field(() => Int, { description: 'Total count of users' })
  total: number;

  @Field(() => Int, { description: 'Current page number' })
  page: number;

  @Field(() => Int, { description: 'Page size' })
  pageSize: number;
}

@ObjectType({ description: 'Generic operation response' })
export class OperationResponse {
  @Field({ description: 'Operation success status' })
  success: boolean;

  @Field({ nullable: true, description: 'Response message' })
  message?: string;
}
