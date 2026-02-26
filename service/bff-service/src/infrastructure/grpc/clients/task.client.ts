import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, timeout, catchError } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { CircuitBreaker, resilientCall, RetryOptions } from '../../resilience/resilience';

// gRPC service interfaces (based on task.proto)
interface TaskServiceGrpc {
  Hello(data: { name: string }, metadata?: Metadata): Observable<any>;
  CreateTask(data: any, metadata?: Metadata): Observable<any>;
  GetTask(data: { id: string; tenant_id: string }, metadata?: Metadata): Observable<any>;
  ListTasks(data: any, metadata?: Metadata): Observable<any>;
  UpdateTask(data: any, metadata?: Metadata): Observable<any>;
  DeleteTask(data: { id: string; tenant_id: string; deleted_by: string }, metadata?: Metadata): Observable<any>;
  UpdateTaskStatus(data: any, metadata?: Metadata): Observable<any>;
  AssignTask(data: any, metadata?: Metadata): Observable<any>;
  BulkUpdateStatus(data: any, metadata?: Metadata): Observable<any>;
  BulkAssign(data: any, metadata?: Metadata): Observable<any>;
  AddComment(data: any, metadata?: Metadata): Observable<any>;
  ListComments(data: { task_id: string }, metadata?: Metadata): Observable<any>;
}

@Injectable()
export class TaskGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(TaskGrpcClient.name);
  private taskService: TaskServiceGrpc;
  private readonly TIMEOUT_MS = 10000;

  // Circuit breaker for task-service downstream
  private readonly taskServiceCB = new CircuitBreaker({
    name: 'task-service',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  });

  // Retry config — exponential backoff on transient errors
  private readonly retryOpts: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 200,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
  };

  constructor(@Inject('TASK_SERVICE') private client: ClientGrpc) { }

  onModuleInit() {
    this.taskService = this.client.getService<TaskServiceGrpc>('TaskService');
    this.logger.log('Task gRPC client initialized');
  }

  private createMetadata(context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }): Metadata {
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
    if (context?.scopes) {
      metadata.set('x-scopes', context.scopes.join(','));
    }
    return metadata;
  }

  private async executeGrpcCall<T>(call: Observable<T>, operation: string): Promise<T> {
    try {
      return await resilientCall(
        this.taskServiceCB,
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
    } catch (error) {
      this.logger.error(`Failed to execute ${operation} (circuit: ${this.taskServiceCB.getState()})`, error);
      throw error;
    }
  }

  // ==================== Task Service Methods ====================

  async hello(name: string) {
    return this.executeGrpcCall(this.taskService.Hello({ name }), 'hello');
  }

  async createTask(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.CreateTask(data, metadata), 'createTask');
  }

  async getTask(id: string, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.GetTask({ id, tenant_id: context?.tenantId || '' }, metadata), 'getTask');
  }

  async listTasks(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.ListTasks(data, metadata), 'listTasks');
  }

  async updateTask(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.UpdateTask(data, metadata), 'updateTask');
  }

  async deleteTask(id: string, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.DeleteTask({ id, tenant_id: context?.tenantId || '', deleted_by: context?.userId || '' }, metadata), 'deleteTask');
  }

  async updateTaskStatus(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.UpdateTaskStatus(data, metadata), 'updateTaskStatus');
  }

  async assignTask(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.AssignTask(data, metadata), 'assignTask');
  }

  async bulkUpdateStatus(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.BulkUpdateStatus(data, metadata), 'bulkUpdateStatus');
  }

  async bulkAssign(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.BulkAssign(data, metadata), 'bulkAssign');
  }

  async addComment(data: any, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.AddComment(data, metadata), 'addComment');
  }

  async listComments(taskId: string, context?: { userId?: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    const metadata = this.createMetadata(context);
    return this.executeGrpcCall(this.taskService.ListComments({ task_id: taskId }, metadata), 'listComments');
  }
}
