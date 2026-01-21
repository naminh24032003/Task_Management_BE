import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';

export interface TokenPayload {
  sub: string; // user ID
  tenantId: string;
  email: string;
  permissions: string[];
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
  permissions?: string[];
}

/**
 * User Authentication Service
 * Handles login, token generation and validation
 */
@Injectable()
export class UserAuthenticationService {
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  // Simple in-memory store for refresh tokens (use Redis in production)
  private refreshTokenStore = new Map<string, { userId: string; tenantId: string }>();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresIn = Number(this.configService.get<number>(
      'JWT_ACCESS_EXPIRES_IN',
      3600,
    )); // 1 hour
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
    const payload: Omit<TokenPayload, 'type'> = {
      sub: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      permissions: [], // TODO: Load permissions from roles
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

    // Store refresh token
    this.refreshTokenStore.set(refreshTokenId, {
      userId: user.id.toString(),
      tenantId: user.tenantId,
    });

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

      // Verify refresh token exists in store
      const stored = this.refreshTokenStore.get(payload.jti);
      if (!stored) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Get user
      const user = await this.userRepository.findById(payload.tenantId, payload.sub);
      if (!user || !user.isActive()) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Remove old refresh token
      this.refreshTokenStore.delete(payload.jti);

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
        permissions: payload.permissions,
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
        this.refreshTokenStore.delete(payload.jti);
      }

      return true;
    } catch {
      return false;
    }
  }
}
