import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, timeout, catchError } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { CircuitBreaker, resilientCall, RetryOptions } from '../../resilience/resilience';

// gRPC service interfaces
interface UserServiceGrpc {
  GetUser(data: { user_id: string }, metadata?: Metadata): Observable<any>;
  GetMe(data: Record<string, never>, metadata?: Metadata): Observable<any>;
  GetUserByEmail(data: { tenant_id?: string; email: string }, metadata?: Metadata): Observable<any>;
  ListUsers(data: { page: number; page_size: number; status_filter?: number; search?: string }, metadata?: Metadata): Observable<any>;
  CreateUser(data: any, metadata?: Metadata): Observable<any>;
  UpdateUser(data: any, metadata?: Metadata): Observable<any>;
  DeleteUser(data: { user_id: string }, metadata?: Metadata): Observable<any>;
  ChangePassword(data: any, metadata?: Metadata): Observable<any>;
  AssignRoles(data: any, metadata?: Metadata): Observable<any>;
  RemoveRoles(data: any, metadata?: Metadata): Observable<any>;
}

interface AuthServiceGrpc {
  Register(data: any, metadata?: Metadata): Observable<any>;
  Login(data: any, metadata?: Metadata): Observable<any>;
  GoogleLogin(data: any, metadata?: Metadata): Observable<any>;
  RefreshToken(data: { refresh_token: string }, metadata?: Metadata): Observable<any>;
  ValidateToken(data: { access_token: string }, metadata?: Metadata): Observable<any>;
  Logout(data: { refresh_token: string }, metadata?: Metadata): Observable<any>;
}

interface GrpcCallMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'success' | 'error';
  errorType?: string;
}

@Injectable()
export class UserGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(UserGrpcClient.name);
  private userService: UserServiceGrpc;
  private authService: AuthServiceGrpc;
  private readonly TIMEOUT_MS = 10000;

  // Circuit breakers — one per downstream logical service
  private readonly userServiceCB = new CircuitBreaker({
    name: 'user-service',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  });
  private readonly authServiceCB = new CircuitBreaker({
    name: 'auth-service',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  });

  // Retry config — only retry transient / network errors
  private readonly retryOpts: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 200,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
  };

  constructor(@Inject('USER_SERVICE') private client: ClientGrpc) { }

  onModuleInit() {
    this.userService = this.client.getService<UserServiceGrpc>('UserService');
    this.authService = this.client.getService<AuthServiceGrpc>('AuthService');
    this.logger.log('User gRPC client initialized');
  }

  private createMetadata(context?: { userId?: string; tenantId?: string; roles?: string[] }): Metadata {
    const metadata = new Metadata();

    // Add trace ID for distributed tracing (OpenTelemetry handles this automatically)
    // We can still add metadata if needed, but standard tracing uses Headers

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

  private logGrpcCall(metrics: GrpcCallMetrics): void {
    this.logger.log(JSON.stringify({
      event: 'grpc_call',
      service: 'bff-service',
      layer: 'grpc_client',
      ...metrics,
      timestamp: new Date().toISOString(),
    }));
  }

  private async executeGrpcCall<T>(call: Observable<T>, operation: string, cb?: CircuitBreaker): Promise<T> {
    const startTime = Date.now();
    const circuitBreaker = cb ?? this.userServiceCB;

    this.logger.log(JSON.stringify({
      event: 'grpc_call_started',
      operation,
      layer: 'grpc_client',
      circuitState: circuitBreaker.getState(),
      timestamp: new Date().toISOString(),
    }));

    try {
      const result = await resilientCall(
        circuitBreaker,
        () =>
          lastValueFrom(
            call.pipe(
              timeout(this.TIMEOUT_MS),
              catchError((error) => {
                this.logger.error(`gRPC call failed for ${operation}: ${error.message}`);
                throw error;
              }),
            ),
          ),
        this.retryOpts,
      );

      const durationMs = Date.now() - startTime;

      this.logGrpcCall({
        operation,
        startTime,
        endTime: Date.now(),
        durationMs,
        status: 'success',
      });

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      this.logGrpcCall({
        operation,
        startTime,
        endTime: Date.now(),
        durationMs,
        status: 'error',
        errorType: error.name || 'UnknownError',
      });

      this.logger.error(JSON.stringify({
        event: 'grpc_call_error',
        operation,
        layer: 'grpc_client',
        durationMs,
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        timestamp: new Date().toISOString(),
      }));

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
    displayName?: string;
  }) {
    const traceId = `reg-${Date.now().toString(36)}`;
    const metadata = this.createMetadata({ tenantId: data.tenantId });

    this.logger.log(JSON.stringify({
      event: 'register_bff_started',
      traceId,
      layer: 'bff',
      tenantId: data.tenantId,
      email: data.email.replace(/(.{3}).*@/, '$1***@'),
      timestamp: new Date().toISOString(),
    }));

    const startTime = Date.now();

    try {
      const grpcData = {
        tenant_id: data.tenantId,
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: data.displayName,
      };

      const result = await this.executeGrpcCall(this.authService.Register(grpcData, metadata), 'register', this.authServiceCB);

      const totalDuration = Date.now() - startTime;

      this.logger.log(JSON.stringify({
        event: 'register_bff_completed',
        traceId,
        layer: 'bff',
        status: 'success',
        totalDurationMs: totalDuration,
        timestamp: new Date().toISOString(),
      }));

      return result;
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;

      this.logger.error(JSON.stringify({
        event: 'register_bff_failed',
        traceId,
        layer: 'bff',
        status: 'error',
        totalDurationMs: totalDuration,
        error: {
          name: error.name,
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      }));

      throw error;
    }
  }

  async login(data: { tenantId: string; email: string; password: string }) {
    const metadata = this.createMetadata({ tenantId: data.tenantId });
    const grpcData = {
      tenant_id: data.tenantId,
      email: data.email,
      password: data.password,
    };
    return this.executeGrpcCall(this.authService.Login(grpcData, metadata), 'login', this.authServiceCB);
  }

  async googleLogin(data: { tenantId: string; idToken: string }) {
    const metadata = this.createMetadata({ tenantId: data.tenantId });
    const grpcData = {
      tenant_id: data.tenantId,
      id_token: data.idToken,
    };
    return this.executeGrpcCall(this.authService.GoogleLogin(grpcData, metadata), 'googleLogin', this.authServiceCB);
  }

  async refreshToken(refreshToken: string) {
    return this.executeGrpcCall(
      this.authService.RefreshToken({ refresh_token: refreshToken }),
      'refreshToken',
      this.authServiceCB,
    );
  }

  async validateToken(accessToken: string) {
    return this.executeGrpcCall(
      this.authService.ValidateToken({ access_token: accessToken }),
      'validateToken',
      this.authServiceCB,
    );
  }

  async logout(refreshToken: string) {
    return this.executeGrpcCall(
      this.authService.Logout({ refresh_token: refreshToken }),
      'logout',
      this.authServiceCB,
    );
  }

  // ==================== User Service Methods ====================

  async getUser(userId: string, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(
      this.userService.GetUser({ user_id: userId }, metadata),
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
      this.userService.GetUserByEmail({ tenant_id: tenantId, email }),
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
        { page, page_size: pageSize, status_filter: statusFilter, search },
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
      this.userService.DeleteUser({ user_id: userId }, metadata),
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
