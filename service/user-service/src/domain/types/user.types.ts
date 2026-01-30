/**
 * User Types
 * Domain interfaces for User aggregate
 */

/**
 * User status enum
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * OAuth Provider types
 */
export type OAuthProvider = 'google' | 'facebook' | 'github';

/**
 * Props for creating a new User
 */
export interface CreateUserProps {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  roleIds?: string[];
}

/**
 * Props for creating OAuth User
 */
export interface CreateOAuthUserProps {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  provider: OAuthProvider;
  providerId: string;
  roleIds?: string[];
}

/**
 * Props for reconstituting User from persistence
 */
export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  status: UserStatus;
  roleIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  provider?: OAuthProvider;
  providerId?: string;
}
