import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, timeout, catchError } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

// gRPC service interfaces (based on task.proto)
interface TaskServiceGrpc {
  Hello(data: { name: string }, metadata?: Metadata): Observable<any>;
  // Add more methods as task-service implements them
  // CreateTask(data: any, metadata?: Metadata): Observable<any>;
  // GetTask(data: { task_id: string }, metadata?: Metadata): Observable<any>;
  // ListTasks(data: any, metadata?: Metadata): Observable<any>;
  // UpdateTask(data: any, metadata?: Metadata): Observable<any>;
  // DeleteTask(data: { task_id: string }, metadata?: Metadata): Observable<any>;
}

@Injectable()
export class TaskGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(TaskGrpcClient.name);
  private taskService: TaskServiceGrpc;
  private readonly TIMEOUT_MS = 10000;

  constructor(@Inject('TASK_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.taskService = this.client.getService<TaskServiceGrpc>('TaskService');
    this.logger.log('Task gRPC client initialized');
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

  // ==================== Task Service Methods ====================

  async hello(name: string) {
    return this.executeGrpcCall(this.taskService.Hello({ name }), 'hello');
  }

  // Placeholder methods for future task operations
  // Uncomment and implement when task-service adds these features

  // async createTask(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
  //   const metadata = this.createMetadata(context);
  //   return this.executeGrpcCall(this.taskService.CreateTask(data, metadata), 'createTask');
  // }

  // async getTask(taskId: string, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
  //   const metadata = this.createMetadata(context);
  //   return this.executeGrpcCall(
  //     this.taskService.GetTask({ task_id: taskId }, metadata),
  //     'getTask',
  //   );
  // }

  // async listTasks(
  //   page: number,
  //   pageSize: number,
  //   filters?: any,
  //   context?: { userId?: string; tenantId?: string; roles?: string[] },
  // ) {
  //   const metadata = this.createMetadata(context);
  //   return this.executeGrpcCall(
  //     this.taskService.ListTasks({ page, page_size: pageSize, ...filters }, metadata),
  //     'listTasks',
  //   );
  // }

  // async updateTask(data: any, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
  //   const metadata = this.createMetadata(context);
  //   return this.executeGrpcCall(this.taskService.UpdateTask(data, metadata), 'updateTask');
  // }

  // async deleteTask(taskId: string, context?: { userId?: string; tenantId?: string; roles?: string[] }) {
  //   const metadata = this.createMetadata(context);
  //   return this.executeGrpcCall(
  //     this.taskService.DeleteTask({ task_id: taskId }, metadata),
  //     'deleteTask',
  //   );
  // }
}
