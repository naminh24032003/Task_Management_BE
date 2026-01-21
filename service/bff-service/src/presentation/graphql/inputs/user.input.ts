import { InputType, Field, Int } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { UserStatus } from '../types/user.type';

@InputType({ description: 'User registration input' })
export class RegisterInput {
  @Field({ description: 'Tenant identifier' })
  @IsNotEmpty()
  tenantId: string;

  @Field({ description: 'User email address' })
  @IsEmail()
  email: string;

  @Field({ description: 'User password (minimum 8 characters)' })
  @MinLength(8)
  password: string;

  @Field({ description: 'User first name' })
  @IsNotEmpty()
  firstName: string;

  @Field({ description: 'User last name' })
  @IsNotEmpty()
  lastName: string;
}

@InputType({ description: 'User login input' })
export class LoginInput {
  @Field({ description: 'Tenant identifier' })
  @IsNotEmpty()
  tenantId: string;

  @Field({ description: 'User email address' })
  @IsEmail()
  email: string;

  @Field({ description: 'User password' })
  @IsNotEmpty()
  password: string;
}

@InputType({ description: 'Google OAuth login input' })
export class GoogleLoginInput {
  @Field({ description: 'Tenant identifier' })
  @IsNotEmpty()
  tenantId: string;

  @Field({ description: 'Google OAuth ID token' })
  @IsNotEmpty()
  idToken: string;
}

@InputType({ description: 'Create user input (admin only)' })
export class CreateUserInput {
  @Field({ description: 'Tenant identifier' })
  @IsNotEmpty()
  tenantId: string;

  @Field({ description: 'User email address' })
  @IsEmail()
  email: string;

  @Field({ description: 'User password (minimum 8 characters)' })
  @MinLength(8)
  password: string;

  @Field({ description: 'User first name' })
  @IsNotEmpty()
  firstName: string;

  @Field({ description: 'User last name' })
  @IsNotEmpty()
  lastName: string;

  @Field(() => [String], { nullable: true, description: 'Role identifiers to assign' })
  @IsOptional()
  roleIds?: string[];
}

@InputType({ description: 'Update user input' })
export class UpdateUserInput {
  @Field({ nullable: true, description: 'User first name' })
  @IsOptional()
  firstName?: string;

  @Field({ nullable: true, description: 'User last name' })
  @IsOptional()
  lastName?: string;

  @Field({ nullable: true, description: 'User display name' })
  @IsOptional()
  displayName?: string;
}

@InputType({ description: 'List users query input' })
export class ListUsersInput {
  @Field(() => Int, { defaultValue: 1, description: 'Page number (1-indexed)' })
  @IsNumber()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 20, description: 'Number of items per page' })
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @Field(() => UserStatus, { nullable: true, description: 'Filter by user status' })
  @IsOptional()
  statusFilter?: UserStatus;

  @Field({ nullable: true, description: 'Search query (email, name)' })
  @IsOptional()
  search?: string;
}

@InputType({ description: 'Change password input' })
export class ChangePasswordInput {
  @Field({ description: 'Current password' })
  @IsNotEmpty()
  currentPassword: string;

  @Field({ description: 'New password (minimum 8 characters)' })
  @MinLength(8)
  newPassword: string;
}

@InputType({ description: 'Assign roles input' })
export class AssignRolesInput {
  @Field({ description: 'User identifier' })
  @IsNotEmpty()
  userId: string;

  @Field(() => [String], { description: 'Role identifiers to assign' })
  @IsNotEmpty()
  roleIds: string[];
}

@InputType({ description: 'Remove roles input' })
export class RemoveRolesInput {
  @Field({ description: 'User identifier' })
  @IsNotEmpty()
  userId: string;

  @Field(() => [String], { description: 'Role identifiers to remove' })
  @IsNotEmpty()
  roleIds: string[];
}
