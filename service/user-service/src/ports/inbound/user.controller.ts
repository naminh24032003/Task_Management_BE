import { Controller } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
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
} from '../../generated/user/v1/user';
import { UserManagementService } from '../../application/services/user-management.service';
import { User, UserStatus as DomainUserStatus } from '../../domain/aggregates/user.aggregate';
import { Metadata } from '@grpc/grpc-js';

@Controller()
@UserServiceControllerMethods()
export class UserController implements UserServiceController {
  constructor(private readonly userManagementService: UserManagementService) {}

  async getUser(request: GetUserRequest, metadata?: Metadata): Promise<GetUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const user = await this.userManagementService.getUserById(tenantId, request.userId);

      return { user: this.toProtoUser(user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  async getMe(request: GetMeRequest, metadata?: Metadata): Promise<GetMeResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const userId = this.extractUserId(metadata);
      const user = await this.userManagementService.getUserById(tenantId, userId);

      return { user: this.toProtoUser(user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  async updateUser(request: UpdateUserRequest, metadata?: Metadata): Promise<UpdateUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const user = await this.userManagementService.updateUser(tenantId, request.userId, {
        firstName: request.firstName,
        lastName: request.lastName,
        displayName: request.displayName,
        status: request.status ? this.toDomainStatus(request.status) : undefined,
      });

      return { user: this.toProtoUser(user) };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  async listUsers(request: ListUsersRequest, metadata?: Metadata): Promise<ListUsersResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      const { users, total } = await this.userManagementService.listUsers(tenantId, {
        page: request.page || 1,
        pageSize: request.pageSize || 10,
        status: request.statusFilter ? this.toDomainStatus(request.statusFilter) : undefined,
        search: request.search,
      });

      return {
        users: users.map((u) => this.toProtoUser(u)),
        total,
        page: request.page || 1,
        pageSize: request.pageSize || 10,
      };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  async deleteUser(request: DeleteUserRequest, metadata?: Metadata): Promise<DeleteUserResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      await this.userManagementService.deleteUser(tenantId, request.userId);

      return { success: true };
    } catch (error: any) {
      throw new RpcException({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  }

  async changePassword(request: ChangePasswordRequest, metadata?: Metadata): Promise<ChangePasswordResponse> {
    try {
      const tenantId = this.extractTenantId(metadata);
      await this.userManagementService.changePassword(
        tenantId,
        request.userId,
        request.currentPassword,
        request.newPassword,
      );

      return { success: true };
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
