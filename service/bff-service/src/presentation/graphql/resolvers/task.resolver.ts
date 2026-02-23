import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { UnifiedAuthGuard } from '../../../infrastructure/auth/guards/unified-auth.guard';
import { ScopesGuard } from '../../../infrastructure/auth/guards/scopes.guard';
import { Public } from '../../../infrastructure/auth/decorators/public.decorator';
import { Scopes } from '../../../infrastructure/auth/decorators/scopes.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../infrastructure/auth/decorators/current-user.decorator';
import {
  HelloResponse,
  Task,
  TaskConnection,
  CursorTaskConnection,
  TaskOperationResponse,
  TaskStatus,
  TaskPriority,
} from '../types/task.type';
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksInput,
  CursorListTasksInput,
  BulkUpdateStatusInput,
} from '../inputs/task.input';
import { CreateTaskUseCase } from '../../../application/task/create-task.usecase';
import { GetTaskUseCase } from '../../../application/task/get-task.usecase';
import { ListTasksUseCase } from '../../../application/task/list-tasks.usecase';
import { UpdateTaskUseCase } from '../../../application/task/update-task.usecase';
import { DeleteTaskUseCase } from '../../../application/task/delete-task.usecase';
import { UpdateTaskStatusUseCase } from '../../../application/task/update-task-status.usecase';
import { AssignTaskUseCase } from '../../../application/task/assign-task.usecase';
import { BulkUpdateStatusUseCase } from '../../../application/task/bulk-update-status.usecase';
import { ListTasksCursorUseCase } from '../../../application/task/list-tasks-cursor.usecase';
import { TaskGrpcClient } from '../../../infrastructure/grpc/clients/task.client';

@Resolver(() => Task)
@UseGuards(UnifiedAuthGuard, ScopesGuard)
export class TaskResolver {
  private readonly logger = new Logger(TaskResolver.name);

  constructor(
    private readonly taskClient: TaskGrpcClient,
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly getTaskUseCase: GetTaskUseCase,
    private readonly listTasksUseCase: ListTasksUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
    private readonly updateTaskStatusUseCase: UpdateTaskStatusUseCase,
    private readonly assignTaskUseCase: AssignTaskUseCase,
    private readonly bulkUpdateStatusUseCase: BulkUpdateStatusUseCase,
    private readonly listTasksCursorUseCase: ListTasksCursorUseCase,
  ) { }

  @Public()
  @Query(() => HelloResponse, { description: 'Test task service connectivity' })
  async taskHello(@Args('name', { defaultValue: 'World' }) name: string): Promise<HelloResponse> {
    this.logger.log(`Hello request with name: ${name}`);
    const result = await this.taskClient.hello(name);
    return {
      message: result.message,
    };
  }

  @Public()
  @Query(() => String, { name: 'taskPing' })
  taskPing(): string {
    return 'pong';
  }

  @Scopes('task:write')
  @Mutation(() => Task, { description: 'Create a new task' })
  async createTask(
    @Args('input', { type: () => CreateTaskInput }) input: CreateTaskInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Task> {
    const result = await this.createTaskUseCase.execute(input, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return this.mapTask(result);
  }

  @Scopes('task:read')
  @Query(() => Task, { description: 'Get task by ID', name: 'task' })
  async getTask(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Task> {
    const task = await this.getTaskUseCase.execute(id, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return this.mapTask(task);
  }

  @Scopes('task:read')
  @Query(() => TaskConnection, { description: 'List tasks with pagination and filters', name: 'tasks' })
  async listTasks(
    @Args('input', { type: () => ListTasksInput }) input: ListTasksInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TaskConnection> {
    const result = await this.listTasksUseCase.execute(input, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return {
      tasks: (result.tasks || []).map((t: any) => this.mapTask(t)),
      total: result.total || 0,
      page: result.page || input.page,
      pageSize: result.page_size || input.pageSize,
    };
  }

  @Scopes('task:read')
  @Query(() => CursorTaskConnection, { description: 'List tasks with cursor-based pagination', name: 'tasksCursor' })
  async listTasksCursor(
    @Args('input', { type: () => CursorListTasksInput }) input: CursorListTasksInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CursorTaskConnection> {
    const result = await this.listTasksCursorUseCase.execute(input, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return {
      tasks: (result.tasks || []).map((t: any) => this.mapTask(t)),
      totalCount: result.total || 0,
      nextCursor: result.next_cursor || undefined,
      hasMore: result.has_more || false,
    };
  }

  @Scopes('task:write')
  @Mutation(() => Task, { description: 'Update an existing task' })
  async updateTask(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateTaskInput }) input: UpdateTaskInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Task> {
    const task = await this.updateTaskUseCase.execute(id, input, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return this.mapTask(task);
  }

  @Scopes('task:write')
  @Mutation(() => TaskOperationResponse, { description: 'Delete a task' })
  async deleteTask(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TaskOperationResponse> {
    const result = await this.deleteTaskUseCase.execute(id, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Scopes('task:write')
  @Mutation(() => Task, { description: 'Update task status' })
  async updateTaskStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => TaskStatus }) status: TaskStatus,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Task> {
    const task = await this.updateTaskStatusUseCase.execute(id, status, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return this.mapTask(task);
  }

  @Scopes('task:write')
  @Mutation(() => Task, { description: 'Assign users to a task' })
  async assignTask(
    @Args('id', { type: () => ID }) id: string,
    @Args('assigneeIds', { type: () => [String] }) assigneeIds: string[],
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Task> {
    const task = await this.assignTaskUseCase.execute(id, assigneeIds, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return this.mapTask(task);
  }

  @Mutation(() => TaskOperationResponse, { description: 'Bulk update task status' })
  async bulkUpdateStatus(
    @Args('input', { type: () => BulkUpdateStatusInput }) input: BulkUpdateStatusInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TaskOperationResponse> {
    const result = await this.bulkUpdateStatusUseCase.execute(input, {
      userId: user.sub,
      tenantId: user.tenantId,
      roles: user.roles,
      scopes: user.scopes,
    });
    return {
      success: result.success,
      message: result.message,
    };
  }

  // ==================== Helper Methods ====================

  private mapTask(grpcTask: any): Task {
    if (!grpcTask) {
      throw new Error('Task not found');
    }

    // Map Enums from numbers (if applicable) or snake_case strings
    const statusMap: Record<number | string, TaskStatus> = {
      0: TaskStatus.UNSPECIFIED,
      1: TaskStatus.OPEN,
      2: TaskStatus.IN_PROGRESS,
      3: TaskStatus.BLOCKED,
      4: TaskStatus.REVIEW,
      5: TaskStatus.COMPLETE,
      6: TaskStatus.CLOSED,
      7: TaskStatus.CANCELLED,
      'TASK_STATUS_UNSPECIFIED': TaskStatus.UNSPECIFIED,
      'TASK_STATUS_OPEN': TaskStatus.OPEN,
      'TASK_STATUS_IN_PROGRESS': TaskStatus.IN_PROGRESS,
      'TASK_STATUS_BLOCKED': TaskStatus.BLOCKED,
      'TASK_STATUS_REVIEW': TaskStatus.REVIEW,
      'TASK_STATUS_COMPLETE': TaskStatus.COMPLETE,
      'TASK_STATUS_CLOSED': TaskStatus.CLOSED,
      'TASK_STATUS_CANCELLED': TaskStatus.CANCELLED,
    };

    const priorityMap: Record<number | string, TaskPriority> = {
      0: TaskPriority.UNSPECIFIED,
      1: TaskPriority.LOW,
      2: TaskPriority.NORMAL,
      3: TaskPriority.HIGH,
      4: TaskPriority.URGENT,
      'TASK_PRIORITY_UNSPECIFIED': TaskPriority.UNSPECIFIED,
      'TASK_PRIORITY_LOW': TaskPriority.LOW,
      'TASK_PRIORITY_NORMAL': TaskPriority.NORMAL,
      'TASK_PRIORITY_HIGH': TaskPriority.HIGH,
      'TASK_PRIORITY_URGENT': TaskPriority.URGENT,
    };

    return {
      id: grpcTask.id,
      tenantId: grpcTask.tenant_id,
      title: grpcTask.title,
      description: grpcTask.description,
      status: statusMap[grpcTask.status] || TaskStatus.UNSPECIFIED,
      priority: priorityMap[grpcTask.priority] || TaskPriority.UNSPECIFIED,
      assigneeIds: grpcTask.assignee_ids || [],
      watcherIds: grpcTask.watcher_ids || [],
      creatorId: grpcTask.creator_id,
      projectId: grpcTask.project_id,
      spaceId: grpcTask.space_id,
      parentTaskId: grpcTask.parent_task_id,
      createdAt: this.convertTimestamp(grpcTask.created_at) || new Date().toISOString(),
      updatedAt: this.convertTimestamp(grpcTask.updated_at) || new Date().toISOString(),
      dueDate: this.convertTimestamp(grpcTask.due_date),
      startDate: this.convertTimestamp(grpcTask.start_date),
      completedAt: this.convertTimestamp(grpcTask.completed_at),
      timeEstimateMinutes: grpcTask.time_estimate_minutes,
      timeTrackedMinutes: grpcTask.time_tracked_minutes || 0,
      tags: grpcTask.tags || [],
      dependencyIds: grpcTask.dependency_ids || [],
      orderIndex: grpcTask.order_index || 0,
    };
  }

  private convertTimestamp(timestamp: any): string | undefined {
    if (!timestamp) return undefined;
    // Protobuf Timestamp: { seconds: number|string, nanos: number }
    if (typeof timestamp === 'object' && timestamp.seconds) {
      const seconds = Number(timestamp.seconds);
      return new Date(seconds * 1000).toISOString();
    }
    if (typeof timestamp === 'string' && timestamp !== "") return timestamp;
    return undefined;
  }
}
