/**
 * Handler Result Types
 * Centralized interfaces for command/query handler results
 */

import { User } from '../../domain/aggregates/user.aggregate';
import { TokenPair } from './auth.types';

// ============================================
// Command Results
// ============================================

export interface CreateUserResult {
  user: User;
}

export interface RegisterUserResult {
  user: User;
  success: boolean;
  message: string;
}

export interface LoginResult {
  user: User;
  tokens: TokenPair;
}

export interface GoogleLoginResult {
  user: User;
  isNewUser: boolean;
}

export interface UpdateUserResult {
  user: User;
}

export interface UpdateUserStatusResult {
  user: User;
}

export interface DeleteUserResult {
  success: boolean;
}

export interface ChangeEmailResult {
  user: User;
}

export interface ChangePasswordResult {
  success: boolean;
}

export interface AssignRolesResult {
  user: User;
}

export interface RemoveRolesResult {
  user: User;
}

// ============================================
// Query Results
// ============================================

export interface GetUserByIdResult {
  user: User;
}

export interface GetUserByEmailResult {
  user: User | null;
}

export interface ListUsersResult {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}
