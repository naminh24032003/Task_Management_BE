import { Controller } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
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
  UserStatus,
} from '../../generated/user/v1/user';
import { UserRegistrationService } from '../../application/services/user-registration.service';
import { UserAuthenticationService } from '../../application/services/user-authentication.service';
import { User } from '../../domain/aggregates/user.aggregate';

@Controller()
@AuthServiceControllerMethods()
export class AuthController implements AuthServiceController {
  constructor(
    private readonly registrationService: UserRegistrationService,
    private readonly authService: UserAuthenticationService,
  ) {}

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      const user = await this.registrationService.register({
        tenantId: request.tenantId,
        email: request.email,
        password: request.password,
        firstName: request.firstName,
        lastName: request.lastName,
        displayName: request.displayName,
      });

      const tokens = await this.authService.generateTokens(user);

      return {
        user: this.toProtoUser(user),
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const { user, tokens } = await this.authService.login({
        tenantId: request.tenantId,
        email: request.email,
        password: request.password,
      });

      return {
        user: this.toProtoUser(user),
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'UNAUTHORIZED',
        message: error.message,
      });
    }
  }

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

  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    const result = await this.authService.validateToken(request.accessToken);

    return {
      valid: result.valid,
      userId: result.userId,
      tenantId: result.tenantId,
      permissions: result.permissions || [],
    };
  }

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
