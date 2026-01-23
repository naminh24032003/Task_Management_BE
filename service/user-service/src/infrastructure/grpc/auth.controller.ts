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
@SkipTenantCheck()
export class AuthController implements AuthServiceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly authService: UserAuthenticationService, // For refresh/validate/logout
  ) { }

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'Register')
  async register(request: any): Promise<RegisterResponse> {
    try {
      const tenantId = request.tenantId || request.tenant_id;
      const email = request.email;
      const password = request.password;
      const firstName = request.firstName || request.first_name;
      const lastName = request.lastName || request.last_name;
      const displayName = request.displayName || request.display_name;

      if (!firstName || !lastName) {
        throw new RpcException({
          code: 3, // INVALID_ARGUMENT
          message: `Missing required fields: firstName=${!!firstName}, lastName=${!!lastName}`,
        });
      }

      const result = await this.commandBus.execute<RegisterUserCommand, RegisterUserResult>(
        new RegisterUserCommand(
          tenantId,
          email,
          password,
          firstName,
          lastName,
          displayName,
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

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'GoogleLogin')
  async googleLogin(request: any): Promise<GoogleLoginResponse> {
    try {
      const tenantId = request.tenantId || request.tenant_id;
      const idToken = request.idToken || request.id_token;

      const result = await this.commandBus.execute<GoogleLoginCommand, GoogleLoginResult>(
        new GoogleLoginCommand(tenantId, idToken),
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

  @SkipTenantCheck()
  @GrpcMethod('AuthService', 'Login')
  async login(request: any): Promise<LoginResponse> {
    try {
      const tenantId = request.tenantId || request.tenant_id;
      const email = request.email;
      const password = request.password;

      const result = await this.commandBus.execute<LoginCommand, LoginResult>(
        new LoginCommand(tenantId, email, password),
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
