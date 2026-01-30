/**
 * Authentication Types
 * Interfaces for authentication-related operations
 */

export interface TokenPayload {
  sub: string; // user ID
  tenantId: string;
  email: string;
  roles: string[];
  scopes: string[];
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginInput {
  tenantId: string;
  email: string;
  password: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  userId?: string;
  tenantId?: string;
  roles?: string[];
  scopes?: string[];
}
