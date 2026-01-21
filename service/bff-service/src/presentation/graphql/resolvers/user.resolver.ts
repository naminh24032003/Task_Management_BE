import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { UserGrpcClient } from '../../../infrastructure/grpc/clients/user.client';
import { UnifiedAuthGuard } from '../../../infrastructure/auth/guards/unified-auth.guard';
import { RolesGuard } from '../../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../infrastructure/auth/decorators/current-user.decorator';
import { Public } from '../../../infrastructure/auth/decorators/public.decorator';
import { RegisterUseCase } from '../../../application/user/register.usecase';
import { LoginUseCase } from '../../../application/user/login.usecase';
import {
  User,
  UserConnection,
  TokenPair,
  AuthPayload,
  OperationResponse,
} from '../types/user.type';
import {
  RegisterInput,
  LoginInput,
  GoogleLoginInput,
  CreateUserInput,
  UpdateUserInput,
  ListUsersInput,
  ChangePasswordInput,
  AssignRolesInput,
  RemoveRolesInput,
} from '../inputs/user.input';

@Resolver(() => User)
@UseGuards(UnifiedAuthGuard)
export class UserResolver {
  private readonly logger = new Logger(UserResolver.name);

  constructor(
    private readonly userClient: UserGrpcClient,
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) { }

  // ==================== Auth Mutations (Public) ====================

  @Public()
  @Mutation(() => AuthPayload, { description: 'Register a new user' })
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    this.logger.log(`Register attempt for email: ${input.email}`);
    const result = await this.registerUseCase.execute(input);
    return {
      user: this.mapUser(result.user),
      success: result.success,
      message: result.message,
    };
  }

  @Public()
  @Mutation(() => AuthPayload, { description: 'Login with email and password' })
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    this.logger.log(`Login attempt for email: ${input.email}`);
    const result = await this.loginUseCase.execute(input);
    return {
      user: this.mapUser(result.user),
      tokens: this.mapTokens(result.tokens),
    };
  }

  @Public()
  @Mutation(() => AuthPayload, { description: 'Login with Google OAuth' })
  async googleLogin(@Args('input') input: GoogleLoginInput): Promise<AuthPayload> {
    this.logger.log(`Google login attempt for tenant: ${input.tenantId}`);
    const result = await this.userClient.googleLogin({
      tenantId: input.tenantId,
      idToken: input.idToken,
    });
    return {
      user: this.mapUser(result.user),
      tokens: this.mapTokens(result.tokens),
      isNewUser: result.is_new_user,
    };
  }

  @Public()
  @Mutation(() => TokenPair, { description: 'Refresh access token' })
  async refreshToken(@Args('refreshToken') refreshToken: string): Promise<TokenPair> {
    this.logger.log('Token refresh attempt');
    const result = await this.userClient.refreshToken(refreshToken);
    return this.mapTokens(result.tokens);
  }

  @Mutation(() => OperationResponse, { description: 'Logout and invalidate refresh token' })
  async logout(@Args('refreshToken') refreshToken: string): Promise<OperationResponse> {
    this.logger.log('Logout attempt');
    const result = await this.userClient.logout(refreshToken);
    return {
      success: result.success,
      message: result.message,
    };
  }

  // ==================== User Queries ====================

  @Query(() => User, { description: 'Get current authenticated user' })
  async me(@CurrentUser() user: CurrentUserPayload): Promise<User> {
    this.logger.log(`GetMe for user: ${user.sub}`);
    const result = await this.userClient.getMe({
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
    });
    return this.mapUser(result.user);
  }

  @Query(() => User, { description: 'Get user by ID' })
  async user(
    @Args('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<User> {
    this.logger.log(`GetUser: ${id}`);
    const result = await this.userClient.getUser(id, {
      userId: currentUser.sub,
      tenantId: currentUser.tenantId,
      roles: currentUser.roles,
    });
    return this.mapUser(result.user);
  }

  @Query(() => UserConnection, { description: 'List users with pagination (admin only)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async users(
    @Args('input') input: ListUsersInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<UserConnection> {
    this.logger.log(`ListUsers: page=${input.page}, pageSize=${input.pageSize}`);
    const result = await this.userClient.listUsers(
      input.page,
      input.pageSize,
      input.statusFilter,
      input.search,
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return {
      users: (result.users || []).map((u: any) => this.mapUser(u)),
      total: result.total || 0,
      page: result.page || input.page,
      pageSize: result.page_size || input.pageSize,
    };
  }

  // ==================== User Mutations ====================

  @Mutation(() => User, { description: 'Create a new user (admin only)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createUser(
    @Args('input') input: CreateUserInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<User> {
    this.logger.log(`CreateUser: ${input.email}`);
    const result = await this.userClient.createUser(
      {
        tenant_id: input.tenantId,
        email: input.email,
        password: input.password,
        first_name: input.firstName,
        last_name: input.lastName,
        role_ids: input.roleIds || [],
      },
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return this.mapUser(result.user);
  }

  @Mutation(() => User, { description: 'Update user information' })
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<User> {
    // Users can only update themselves unless they are admin
    if (currentUser.sub !== id && !currentUser.roles?.includes('admin')) {
      throw new Error('Not authorized to update this user');
    }

    this.logger.log(`UpdateUser: ${id}`);
    const result = await this.userClient.updateUser(
      {
        user_id: id,
        first_name: input.firstName,
        last_name: input.lastName,
        display_name: input.displayName,
      },
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return this.mapUser(result.user);
  }

  @Mutation(() => OperationResponse, { description: 'Delete user (admin only)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deleteUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<OperationResponse> {
    this.logger.log(`DeleteUser: ${id}`);
    const result = await this.userClient.deleteUser(id, {
      userId: currentUser.sub,
      tenantId: currentUser.tenantId,
      roles: currentUser.roles,
    });
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Mutation(() => OperationResponse, { description: 'Change user password' })
  async changePassword(
    @Args('input') input: ChangePasswordInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<OperationResponse> {
    this.logger.log(`ChangePassword for user: ${currentUser.sub}`);
    const result = await this.userClient.changePassword(
      {
        user_id: currentUser.sub,
        current_password: input.currentPassword,
        new_password: input.newPassword,
      },
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Mutation(() => User, { description: 'Assign roles to user (admin only)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async assignRoles(
    @Args('input') input: AssignRolesInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<User> {
    this.logger.log(`AssignRoles to user: ${input.userId}`);
    const result = await this.userClient.assignRoles(
      {
        userId: input.userId,
        roleIds: input.roleIds,
      },
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return this.mapUser(result.user);
  }

  @Mutation(() => User, { description: 'Remove roles from user (admin only)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async removeRoles(
    @Args('input') input: RemoveRolesInput,
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<User> {
    this.logger.log(`RemoveRoles from user: ${input.userId}`);
    const result = await this.userClient.removeRoles(
      {
        userId: input.userId,
        roleIds: input.roleIds,
      },
      {
        userId: currentUser.sub,
        tenantId: currentUser.tenantId,
        roles: currentUser.roles,
      },
    );
    return this.mapUser(result.user);
  }

  // ==================== Helper Methods ====================

  private mapUser(grpcUser: any): User {
    if (!grpcUser) {
      throw new Error('User not found');
    }
    return {
      id: grpcUser.id,
      tenantId: grpcUser.tenantId,
      email: grpcUser.email,
      firstName: grpcUser.firstName,
      lastName: grpcUser.lastName,
      displayName: grpcUser.displayName,
      status: grpcUser.status,
      roleIds: grpcUser.roleIds || [],
      createdAt: grpcUser.createdAt,
      updatedAt: grpcUser.updatedAt,
      lastLoginAt: grpcUser.lastLoginAt,
    };
  }

  private mapTokens(grpcTokens: any): TokenPair {
    if (!grpcTokens) {
      throw new Error('Failed to generate tokens');
    }
    return {
      accessToken: grpcTokens.accessToken,
      refreshToken: grpcTokens.refreshToken,
      expiresIn: Number(grpcTokens.expiresIn),
    };
  }
}
