import { User } from '../../domain/aggregates/user.aggregate';

/**
 * Token pair returned after successful authentication
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
    user: User;
    tokens: TokenPair;
}

/**
 * Email/Password login credentials
 */
export interface EmailPasswordCredentials {
    tenantId: string;
    email: string;
    password: string;
}

/**
 * OAuth credentials (Google, Facebook, Apple, etc.)
 */
export interface OAuthCredentials {
    tenantId: string;
    provider: 'google' | 'facebook' | 'apple';
    idToken: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
    valid: boolean;
    userId?: string;
    tenantId?: string;
    roles?: string[];
    scopes?: string[];
}

/**
 * Authentication Strategy Port (Interface)
 * 
 * Defines contract for different authentication methods:
 * - Email/Password
 * - Google OAuth
 * - Facebook OAuth (future)
 * - Apple Sign In (future)
 * - SSO/SAML (future)
 * 
 * Implementations should handle their specific authentication logic
 * while returning a consistent AuthenticationResult.
 */
export interface IAuthenticationStrategy {
    /**
     * Strategy identifier
     */
    readonly strategyName: string;

    /**
     * Authenticate user with provided credentials
     * @returns AuthenticationResult with user and tokens
     * @throws UnauthorizedException if authentication fails
     */
    authenticate(credentials: unknown): Promise<AuthenticationResult>;

    /**
     * Check if this strategy supports the given credentials type
     */
    supports(credentials: unknown): boolean;
}

export const AUTHENTICATION_STRATEGY = Symbol('IAuthenticationStrategy');

/**
 * Authentication Service Port (Interface)
 * 
 * Main authentication service that orchestrates multiple strategies
 * and handles common operations like token refresh and logout.
 */
export interface IAuthenticationService {
    /**
     * Login with email and password
     */
    loginWithEmailPassword(credentials: EmailPasswordCredentials): Promise<AuthenticationResult>;

    /**
     * Login with OAuth provider
     */
    loginWithOAuth(credentials: OAuthCredentials): Promise<AuthenticationResult>;

    /**
     * Refresh access token using refresh token
     */
    refreshToken(refreshToken: string): Promise<TokenPair>;

    /**
     * Validate access token
     */
    validateToken(accessToken: string): Promise<TokenValidationResult>;

    /**
     * Validate token with cache-first strategy
     */
    validateTokenWithCache(accessToken: string): Promise<TokenValidationResult>;

    /**
     * Logout - invalidate refresh token
     */
    logout(refreshToken: string): Promise<boolean>;

    /**
     * Get user permissions with cache
     */
    getPermissionsWithCache(tenantId: string, userId: string): Promise<string[]>;

    /**
     * Get user roles with cache
     */
    getRolesWithCache(tenantId: string, userId: string): Promise<string[]>;

    /**
     * Invalidate all cache for a user
     */
    invalidateUserCache(tenantId: string, userId: string): Promise<void>;
}

export const AUTHENTICATION_SERVICE = Symbol('IAuthenticationService');
