import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { IRoleRepository, ROLE_REPOSITORY } from '../ports/role-repository.port';
import { IPermissionRepository, PERMISSION_REPOSITORY } from '../ports/permission-repository.port';
import { IAuthCacheService, AUTH_CACHE_SERVICE } from '../ports/auth-cache.port';

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

/**
 * User Authentication Service
 * Handles login, token generation and validation
 *
 * Uses Redis cache for:
 * - Session caching (99%+ cache hit rate target)
 * - Refresh token storage
 * - Permissions caching
 */
@Injectable()
export class UserAuthenticationService {
  private readonly logger = new Logger(UserAuthenticationService.name);
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(AUTH_CACHE_SERVICE)
    private readonly authCache: IAuthCacheService,
  ) {
    this.accessTokenExpiresIn = Number(this.configService.get<number>(
      'JWT_ACCESS_EXPIRES_IN',
      900,
    )); // 15 minutes
    this.refreshTokenExpiresIn = Number(this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN',
      604800,
    )); // 7 days
  }

  /**
   * Login user with email and password
   */
  async login(input: LoginInput): Promise<{ user: User; tokens: TokenPair }> {
    // Find user by email
    const user = await this.userRepository.findByEmail(input.tenantId, input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive()) {
      throw new ForbiddenException('Account is not active');
    }

    // Verify password
    if (!user.verifyPassword(input.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Record login
    user.recordLogin();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(user: User): Promise<TokenPair> {
    // Load roles
    const roles = await this.roleRepository.findByIds(user.tenantId, user.roleIds);
    const roleNames = roles.map(r => r.name);

    // Load permissions for roles
    const allPermissionIds = [...new Set(roles.flatMap(r => r.permissionIds))];
    const permissions = await this.permissionRepository.findByIds(user.tenantId, allPermissionIds);
    const scopes = permissions.map(p => `${p.resource}:${p.action}`);

    const payload: Omit<TokenPayload, 'type'> = {
      sub: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      roles: roleNames,
      scopes: scopes,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.accessTokenExpiresIn },
    );

    const refreshTokenId = uuidv4();
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: refreshTokenId },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    // Store refresh token in Redis cache
    await this.authCache.storeRefreshToken(refreshTokenId, {
      userId: user.id.toString(),
      tenantId: user.tenantId,
      createdAt: Date.now(),
    }, this.refreshTokenExpiresIn);

    // Cache session for fast token validation (99%+ cache hit target)
    const exp = Math.floor(Date.now() / 1000) + this.accessTokenExpiresIn;
    await this.authCache.cacheSession(accessToken, {
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      roles: roleNames,
      scopes: scopes,
      exp,
    });

    // Cache permissions and roles for subsequent requests
    await Promise.all([
      this.authCache.cachePermissions(user.tenantId, user.id.toString(), scopes),
      this.authCache.cacheRoles(user.tenantId, user.id.toString(), roleNames),
    ]);

    this.logger.debug(`Generated tokens for user ${user.id}, cached session and permissions`);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<TokenPayload & { jti: string }>(
        refreshToken,
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify refresh token exists in Redis cache
      const stored = await this.authCache.getRefreshToken(payload.jti);
      if (!stored) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Get user
      const user = await this.userRepository.findById(payload.tenantId, payload.sub);
      if (!user || !user.isActive()) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Remove old refresh token from cache
      await this.authCache.revokeRefreshToken(payload.jti);

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<ValidateTokenResult> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(accessToken);

      if (payload.type !== 'access') {
        return { valid: false };
      }

      return {
        valid: true,
        userId: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles,
        scopes: payload.scopes,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(refreshToken: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify<TokenPayload & { jti: string }>(
        refreshToken,
      );

      if (payload.jti) {
        await this.authCache.revokeRefreshToken(payload.jti);
      }

      this.logger.debug(`User ${payload.sub} logged out`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate access token with cache-first strategy
   * Cache hit rate should be 99%+ in production
   */
  async validateTokenWithCache(accessToken: string): Promise<ValidateTokenResult> {
    // Try cache first (99%+ hit rate target)
    const cached = await this.authCache.getSession(accessToken);
    if (cached) {
      // Check if token is still valid (not expired)
      if (cached.exp > Math.floor(Date.now() / 1000)) {
        return {
          valid: true,
          userId: cached.userId,
          tenantId: cached.tenantId,
          roles: cached.roles,
          scopes: cached.scopes,
        };
      }
      // Token expired, remove from cache
      await this.authCache.invalidateSession(accessToken);
    }

    // Cache miss - validate JWT and cache result
    return this.validateToken(accessToken);
  }

  /**
   * Get user permissions with cache-first strategy
   */
  async getPermissionsWithCache(tenantId: string, userId: string): Promise<string[]> {
    // Try cache first
    const cached = await this.authCache.getPermissions(tenantId, userId);
    if (cached) {
      return cached;
    }

    // Cache miss - load from database
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) {
      return [];
    }

    const roles = await this.roleRepository.findByIds(tenantId, user.roleIds);
    const allPermissionIds = [...new Set(roles.flatMap(r => r.permissionIds))];
    const permissions = await this.permissionRepository.findByIds(tenantId, allPermissionIds);
    const scopes = permissions.map(p => `${p.resource}:${p.action}`);

    // Cache for subsequent requests
    await this.authCache.cachePermissions(tenantId, userId, scopes);

    return scopes;
  }

  /**
   * Get user roles with cache-first strategy
   */
  async getRolesWithCache(tenantId: string, userId: string): Promise<string[]> {
    // Try cache first
    const cached = await this.authCache.getRoles(tenantId, userId);
    if (cached) {
      return cached;
    }

    // Cache miss - load from database
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) {
      return [];
    }

    const roles = await this.roleRepository.findByIds(tenantId, user.roleIds);
    const roleNames = roles.map(r => r.name);

    // Cache for subsequent requests
    await this.authCache.cacheRoles(tenantId, userId, roleNames);

    return roleNames;
  }

  /**
   * Invalidate all cache for a user (role/permission change, logout all devices)
   */
  async invalidateUserCache(tenantId: string, userId: string): Promise<void> {
    await Promise.all([
      this.authCache.invalidatePermissions(tenantId, userId),
      this.authCache.invalidateRoles(tenantId, userId),
      this.authCache.revokeAllUserRefreshTokens(userId),
    ]);
    this.logger.log(`Invalidated all cache for user ${userId}`);
  }
}
