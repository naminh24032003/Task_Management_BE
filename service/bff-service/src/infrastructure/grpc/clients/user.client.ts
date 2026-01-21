import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, timeout, catchError } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

// gRPC service interfaces
interface UserServiceGrpc {
  GetUser(data: { userId: string }, metadata?: Metadata): Observable<any>;
  GetMe(data: Record<string, never>, metadata?: Metadata): Observable<any>;
  GetUserByEmail(data: { tenantId: string; email: string }, metadata?: Metadata): Observable<any>;
  ListUsers(data: { page: number; pageSize: number; statusFilter?: number; search?: string }, metadata?: Metadata): Observable<any>;
  CreateUser(data: any, metadata?: Metadata): Observable<any>;
  UpdateUser(data: any, metadata?: Metadata): Observable<any>;
  DeleteUser(data: { userId: string }, metadata?: Metadata): Observable<any>;
  ChangePassword(data: any, metadata?: Metadata): Observable<any>;
  AssignRoles(data: any, metadata?: Metadata): Observable<any>;
  RemoveRoles(data: any, metadata?: Metadata): Observable<any>;
}

interface AuthServiceGrpc {
  Register(data: any, metadata?: Metadata): Observable<any>;
  Login(data: any, metadata?: Metadata): Observable<any>;
  GoogleLogin(data: any, metadata?: Metadata): Observable<any>;
  RefreshToken(data: { refreshToken: string }, metadata?: Metadata): Observable<any>;
  ValidateToken(data: { accessToken: string }, metadata?: Metadata): Observable<any>;
  Logout(data: { refreshToken: string }, metadata?: Metadata): Observable<any>;
}

@Injectable()
export class UserGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(UserGrpcClient.name);
  private userService: UserServiceGrpc;
  private authService: AuthServiceGrpc;
  private readonly TIMEOUT_MS = 10000;

  constructor(@Inject('USER_SERVICE') private client: ClientGrpc) { }

  onModuleInit() {
    this.userService = this.client.getService<UserServiceGrpc>('UserService');
    this.authService = this.client.getService<AuthServiceGrpc>('AuthService');
    this.logger.log('User gRPC client initialized');
  }

  private createMetadata(context?: { userId?: string; tenantId?: string; roles?: string[] }): Metadata {
    const metadata = new Metadata();
    if (context?.userId) {
      metadata.set('x-user-id', context.userId);
    }
    if (context?.tenantId) {
      metadata.set('x-tenant-id', context.tenantId);
    }
    if (context?.roles) {
      metadata.set('x-roles', context.roles.join(','));
    }
    return metadata;
  }

  private async executeGrpcCall<T>(call: Observable<T>, operation: string): Promise<T> {
    try {
      return await lastValueFrom(
        call.pipe(
          timeout(this.TIMEOUT_MS),
          catchError((error) => {
            this.logger.error(`gRPC call failed for ${operation}: ${error.message}`);
            throw error;
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to execute ${operation}`, error);
      throw error;
    }
  }

  // ==================== Auth Service Methods ====================

  async register(data: {
    tenantId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    return this.executeGrpcCall(this.authService.Register(data), 'register');
  }

  async login(data: { tenantId: string; email: string; password: string }) {
    return this.executeGrpcCall(this.authService.Login(data), 'login');
  }

  async googleLogin(data: { tenantId: string; idToken: string }) {
    return this.executeGrpcCall(this.authService.GoogleLogin(data), 'googleLogin');
  }

  async refreshToken(refreshToken: string) {
    return this.executeGrpcCall(
      this.authService.RefreshToken({ refreshToken }),
      'refreshToken',
    );
  }

  async validateToken(accessToken: string) {
    return this.executeGrpcCall(
      this.authService.ValidateToken({ accessToken }),
      'validateToken',
    );
  }

  async logout(refreshToken: string) {
    return this.executeGrpcCall(
      this.authService.Logout({ refreshToken }),
      'logout',
    );
  }

  // ==================== User Service Methods ====================

  async getUser(userId: string, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(
      this.userService.GetUser({ userId }, metadata),
      'getUser',
    );
  }

  async getMe(context: { userId: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(
      this.userService.GetMe({}, metadata),
      'getMe',
    );
  }

  async getUserByEmail(tenantId: string, email: string) {
    return this.executeGrpcCall(
      this.userService.GetUserByEmail({ tenantId, email }),
      'getUserByEmail',
    );
  }

  async listUsers(
    page: number,
    pageSize: number,
    statusFilter?: number,
    search?: string,
    context?: { userId?: string; tenantId?: string; roles?: string[] },
  ) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(
      this.userService.ListUsers(
        { page, pageSize, statusFilter, search },
        metadata,
      ),
      'listUsers',
    );
  }

  async createUser(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.userService.CreateUser(data, metadata), 'createUser');
  }

  async updateUser(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.userService.UpdateUser(data, metadata), 'updateUser');
  }

  async deleteUser(userId: string, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(
      this.userService.DeleteUser({ userId }, metadata),
      'deleteUser',
    );
  }

  async changePassword(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.userService.ChangePassword(data, metadata), 'changePassword');
  }

  async assignRoles(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.userService.AssignRoles(data, metadata), 'assignRoles');
  }

  async removeRoles(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.userService.RemoveRoles(data, metadata), 'removeRoles');
  }
}
