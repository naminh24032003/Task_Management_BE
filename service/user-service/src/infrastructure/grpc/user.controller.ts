import { Controller, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import {
  UserServiceController,
  UserServiceControllerMethods,
  GetUserRequest,
  GetUserResponse,
  GetMeRequest,
  GetMeResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  ListUsersRequest,
  ListUsersResponse,
  DeleteUserRequest,
  DeleteUserResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  UserStatus,
  CreateUserRequest,
  CreateUserResponse,
  GetUserByEmailRequest,
  GetUserByEmailResponse,
  ChangeEmailRequest,
  ChangeEmailResponse,
  ActivateUserRequest,
  ActivateUserResponse,
  DeactivateUserRequest,
  DeactivateUserResponse,
  SuspendUserRequest,
  SuspendUserResponse,
  AssignRolesRequest,
  AssignRolesResponse,
  RemoveRolesRequest,
  RemoveRolesResponse,
} from '../../generated/user/v1/user';
import { User, UserStatus as DomainUserStatus } from '../../domain/aggregates/user.aggregate';
import { Metadata } from '@grpc/grpc-js';

// gRPC Auth - only AuthN (authentication), AuthZ will be in task-service
import { GrpcAuthInterceptor } from './interceptors/grpc-auth.interceptor';
import { GrpcAuthGuard } from './guards/grpc-auth.guard';

// Queries
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id/get-user-by-id.query';
import { GetUserByIdResult } from '../../application/queries/get-user-by-id/get-user-by-id.handler';
import { GetUserByEmailQuery } from '../../application/queries/get-user-by-email/get-user-by-email.query';
import { GetUserByEmailResult } from '../../application/queries/get-user-by-email/get-user-by-email.handler';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ListUsersResult } from '../../application/queries/list-users/list-users.handler';

// Commands
import { CreateUserCommand } from '../../application/commands/create-user/create-user.command';
import { CreateUserResult } from '../../application/commands/create-user/create-user.handler';
import { UpdateUserCommand } from '../../application/commands/update-user/update-user.command';
import { UpdateUserResult } from '../../application/commands/update-user/update-user.handler';
import { DeleteUserCommand } from '../../application/commands/delete-user/delete-user.command';
import { DeleteUserResult } from '../../application/commands/delete-user/delete-user.handler';
import { ChangePasswordCommand } from '../../application/commands/change-password/change-password.command';
import { ChangePasswordResult } from '../../application/commands/change-password/change-password.handler';
import { ChangeEmailCommand } from '../../application/commands/change-email/change-email.command';
import { ChangeEmailResult } from '../../application/commands/change-email/change-email.handler';
import { UpdateUserStatusCommand } from '../../application/commands/update-user-status/update-user-status.command';
import { UpdateUserStatusResult } from '../../application/commands/update-user-status/update-user-status.handler';
import { AssignRolesCommand } from '../../application/commands/assign-roles/assign-roles.command';
import { AssignRolesResult } from '../../application/commands/assign-roles/assign-roles.handler';
import { RemoveRolesCommand } from '../../application/commands/remove-roles/remove-roles.command';
import { RemoveRolesResult } from '../../application/commands/remove-roles/remove-roles.handler';

/**
 * UserController - gRPC endpoints for user management
 *
 * Authentication (AuthN):
 * - Kong verifies JWT and injects identity headers (x-user-id, x-tenant-id, etc.)
 * - GrpcAuthInterceptor extracts identity from gRPC metadata
 * - GrpcAuthGuard verifies user is authenticated
 *
 * Authorization (AuthZ):
 * - Role/permission checks will be implemented in task-service (core service)
 * - User-service only handles AuthN
 */
@Controller()
@UserServiceControllerMethods()
@UseInterceptors(GrpcAuthInterceptor)
export class UserController implements UserServiceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) { }

  // ============================================
  // Query Endpoints
  // ============================================

  @GrpcMethod('UserService', 'GetUser')
  async getUser(request: GetUserRequest, metadata?: Metadata): Promise<GetUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.queryBus.execute<GetUserByIdQuery, GetUserByIdResult>(
        new GetUserByIdQuery(tenantId, request.userId),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetMe')
  @UseGuards(GrpcAuthGuard)
  async getMe(_request: GetMeRequest, metadata?: Metadata): Promise<GetMeResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const userId = this.extractUserId(metadata);
      const result = await this.queryBus.execute<GetUserByIdQuery, GetUserByIdResult>(
        new GetUserByIdQuery(tenantId, userId),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'ListUsers')
  async listUsers(request: ListUsersRequest, metadata?: Metadata): Promise<ListUsersResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.queryBus.execute<ListUsersQuery, ListUsersResult>(
        new ListUsersQuery(
          tenantId,
          request.page || 1,
          request.pageSize || 10,
          request.statusFilter ? this.toDomainStatus(request.statusFilter) : undefined,
          request.search,
          request.cursor || undefined,
          request.limit || undefined,
        ),
      );

      return {
        users: result.users.map((u) => this.toProtoUser(u)),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages || 0,
        nextCursor: result.nextCursor || '',
        hasMore: result.hasMore || false,
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserByEmail')
  async getUserByEmail(request: GetUserByEmailRequest, metadata?: Metadata): Promise<GetUserByEmailResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.queryBus.execute<GetUserByEmailQuery, GetUserByEmailResult>(
        new GetUserByEmailQuery(tenantId, request.email),
      );

      if (!result.user) {
        throw new RpcException({
          code: 'NOT_FOUND',
          message: `User with email ${request.email} not found`,
        });
      }

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  // ============================================
  // Command Endpoints (AuthN required)
  // ============================================

  @GrpcMethod('UserService', 'CreateUser')
  @UseGuards(GrpcAuthGuard)
  async createUser(request: CreateUserRequest, metadata?: Metadata): Promise<CreateUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<CreateUserCommand, CreateUserResult>(
        new CreateUserCommand(
          tenantId,
          request.email,
          request.password,
          request.firstName,
          request.lastName,
          request.displayName,
          request.roleIds,
          request.status ? this.toDomainStatus(request.status) : undefined,
        ),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'UpdateUser')
  @UseGuards(GrpcAuthGuard)
  async updateUser(request: UpdateUserRequest, metadata?: Metadata): Promise<UpdateUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<UpdateUserCommand, UpdateUserResult>(
        new UpdateUserCommand(
          tenantId,
          request.userId,
          request.firstName,
          request.lastName,
          request.displayName,
          request.status ? this.toDomainStatus(request.status) : undefined,
        ),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'DeleteUser')
  @UseGuards(GrpcAuthGuard)
  async deleteUser(request: DeleteUserRequest, metadata?: Metadata): Promise<DeleteUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<DeleteUserCommand, DeleteUserResult>(
        new DeleteUserCommand(tenantId, request.userId),
      );

      return { success: result.success };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'ChangePassword')
  @UseGuards(GrpcAuthGuard)
  async changePassword(request: ChangePasswordRequest, metadata?: Metadata): Promise<ChangePasswordResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<ChangePasswordCommand, ChangePasswordResult>(
        new ChangePasswordCommand(
          tenantId,
          request.userId,
          request.currentPassword,
          request.newPassword,
        ),
      );

      return { success: result.success };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'ChangeEmail')
  @UseGuards(GrpcAuthGuard)
  async changeEmail(request: ChangeEmailRequest, metadata?: Metadata): Promise<ChangeEmailResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<ChangeEmailCommand, ChangeEmailResult>(
        new ChangeEmailCommand(tenantId, request.userId, request.newEmail),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'ActivateUser')
  @UseGuards(GrpcAuthGuard)
  async activateUser(request: ActivateUserRequest, metadata?: Metadata): Promise<ActivateUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<UpdateUserStatusCommand, UpdateUserStatusResult>(
        new UpdateUserStatusCommand(tenantId, request.userId, DomainUserStatus.ACTIVE),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'DeactivateUser')
  @UseGuards(GrpcAuthGuard)
  async deactivateUser(request: DeactivateUserRequest, metadata?: Metadata): Promise<DeactivateUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<UpdateUserStatusCommand, UpdateUserStatusResult>(
        new UpdateUserStatusCommand(tenantId, request.userId, DomainUserStatus.INACTIVE),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'SuspendUser')
  @UseGuards(GrpcAuthGuard)
  async suspendUser(request: SuspendUserRequest, metadata?: Metadata): Promise<SuspendUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<UpdateUserStatusCommand, UpdateUserStatusResult>(
        new UpdateUserStatusCommand(tenantId, request.userId, DomainUserStatus.SUSPENDED),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'AssignRoles')
  @UseGuards(GrpcAuthGuard)
  async assignRoles(request: AssignRolesRequest, metadata?: Metadata): Promise<AssignRolesResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<AssignRolesCommand, AssignRolesResult>(
        new AssignRolesCommand(tenantId, request.userId, request.roleIds),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'RemoveRoles')
  @UseGuards(GrpcAuthGuard)
  async removeRoles(request: RemoveRolesRequest, metadata?: Metadata): Promise<RemoveRolesResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const result = await this.commandBus.execute<RemoveRolesCommand, RemoveRolesResult>(
        new RemoveRolesCommand(tenantId, request.userId, request.roleIds),
      );

      return { user: this.toProtoUser(result.user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private extractTenantId(metadata?: Metadata): string {
    const tenantId = metadata?.get('x-tenant-id')?.[0]?.toString();
    if (!tenantId) {
      throw new RpcException({
        code: 'INVALID_ARGUMENT',
        message: 'x-tenant-id header is required',
      });
    }
    return tenantId;
  }

  private extractUserId(metadata?: Metadata): string {
    const userId = metadata?.get('x-user-id')?.[0]?.toString();
    if (!userId) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated',
      });
    }
    return userId;
  }

  private toProtoUser(user: User): GetUserResponse['user'] {
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

  private toDomainStatus(status: UserStatus): DomainUserStatus | undefined {
    const statusMap: Record<UserStatus, DomainUserStatus | undefined> = {
      [UserStatus.USER_STATUS_ACTIVE]: DomainUserStatus.ACTIVE,
      [UserStatus.USER_STATUS_INACTIVE]: DomainUserStatus.INACTIVE,
      [UserStatus.USER_STATUS_SUSPENDED]: DomainUserStatus.SUSPENDED,
      [UserStatus.USER_STATUS_DELETED]: DomainUserStatus.DELETED,
      [UserStatus.USER_STATUS_UNSPECIFIED]: undefined,
      [UserStatus.UNRECOGNIZED]: undefined,
    };
    return statusMap[status];
  }
}
