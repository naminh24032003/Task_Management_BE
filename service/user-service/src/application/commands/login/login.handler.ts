import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { LoginCommand } from './login.command';
import { User } from '../../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: User;
  tokens: TokenPair;
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  // In-memory store for refresh tokens (use Redis in production)
  private static refreshTokenStore = new Map<string, { userId: string; tenantId: string }>();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresIn = this.configService.get<number>('JWT_ACCESS_EXPIRES_IN', 3600);
    this.refreshTokenExpiresIn = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800);
  }

  async execute(command: LoginCommand): Promise<LoginResult> {
    // Find user
    const user = await this.userRepository.findByEmail(command.tenantId, command.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive()) {
      throw new ForbiddenException('Account is not active');
    }

    // Check if OAuth user trying to login with password
    if (user.isOAuthUser()) {
      throw new UnauthorizedException('Please login with your OAuth provider');
    }

    if (!user.verifyPassword(command.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Record login
    user.recordLogin();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      permissions: [],
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

    LoginHandler.refreshTokenStore.set(refreshTokenId, {
      userId: user.id.toString(),
      tenantId: user.tenantId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }
}
