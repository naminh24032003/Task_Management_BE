import { Controller } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { SkipTenantCheck } from '../multi-tenancy/decorators/skip-tenant-check.decorator';
import {
  AuthServiceController,
  AuthServiceControllerMethods,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  LogoutRequest,
  LogoutResponse,
  GoogleLoginRequest,
  GoogleLoginResponse,
  UserStatus,
} from '../../generated/user/v1/user';
import { RegisterUserCommand } from '../../application/commands/register-user/register-user.command';
import { RegisterUserResult } from '../../application/commands/register-user/register-user.handler';
import { LoginCommand } from '../../application/commands/login/login.command';
import { LoginResult } from '../../application/commands/login/login.handler';
import { GoogleLoginCommand } from '../../application/commands/google-login/google-login.command';
import { GoogleLoginResult } from '../../application/commands/google-login/google-login.handler';
import { UserAuthenticationService } from '../../application/services/user-authentication.service';
import { User } from '../../domain/aggregates/user.aggregate';

@Controller()
@AuthServiceControllerMethods()
export class AuthController implements AuthServiceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly authService: UserAuthenticationService, // For refresh/validate/logout
  ) { }

  @GrpcMethod('AuthService', 'Register')
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      const result = await this.commandBus.execute<RegisterUserCommand, RegisterUserResult>(
        new RegisterUserCommand(
          request.tenantId,
          request.email,
          request.password,
          request.firstName,
          request.lastName,
          request.displayName,
        ),
      );

      return {
        user: this.toProtoUser(result.user),
        success: result.success,
        message: result.message,
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GoogleLogin')
  async googleLogin(request: GoogleLoginRequest): Promise<GoogleLoginResponse> {
    try {
      const result = await this.commandBus.execute<GoogleLoginCommand, GoogleLoginResult>(
        new GoogleLoginCommand(request.tenantId, request.idToken),
      );

      // Generate tokens for the user
      const tokens = await this.authService.generateTokens(result.user);

      return {
        user: this.toProtoUser(result.user),
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
        isNewUser: result.isNewUser,
      };
    } catch (error: any) {
      throw new RpcException({
        code: 'UNAUTHORIZED',
        message: error.message || 'Google authentication failed',
      });
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const result = await this.commandBus.execute<LoginCommand, LoginResult>(
        new LoginCommand(request.tenantId, request.email, request.password),
      );

      return {
        user: this.toProtoUser(result.user),
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
        },
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'UNAUTHORIZED',
        message: error.message,
      });
    }
  }

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'RefreshToken')
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      const tokens = await this.authService.refreshToken(request.refreshToken);

      return {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      };
    } catch (error: any) {
      throw new RpcException({
        code: 'UNAUTHORIZED',
        message: error.message,
      });
    }
  }

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    const result = await this.authService.validateToken(request.accessToken);

    return {
      valid: result.valid,
      userId: result.userId,
      tenantId: result.tenantId,
      permissions: result.permissions || [],
    };
  }

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'Logout')
  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    const success = await this.authService.logout(request.refreshToken);
    return { success };
  }

  /**
   * Convert domain User to Proto User
   */
  private toProtoUser(user: User): RegisterResponse['user'] {
    return {
      id: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      status: this.toProtoStatus(user.status),
      roleIds: user.roleIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private toProtoStatus(status: string): UserStatus {
    const statusMap: Record<string, UserStatus> = {
      active: UserStatus.USER_STATUS_ACTIVE,
      inactive: UserStatus.USER_STATUS_INACTIVE,
      suspended: UserStatus.USER_STATUS_SUSPENDED,
      deleted: UserStatus.USER_STATUS_DELETED,
    };
    return statusMap[status] || UserStatus.USER_STATUS_UNSPECIFIED;
  }
}
