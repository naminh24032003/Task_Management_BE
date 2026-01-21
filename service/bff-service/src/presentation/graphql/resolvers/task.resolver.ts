import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../../infrastructure/grpc/clients/task.client';
import { UnifiedAuthGuard } from '../../../infrastructure/auth/guards/unified-auth.guard';
import { Public } from '../../../infrastructure/auth/decorators/public.decorator';
import { HelloResponse } from '../types/task.type';

@Resolver()
@UseGuards(UnifiedAuthGuard)
export class TaskResolver {
  private readonly logger = new Logger(TaskResolver.name);

  constructor(private readonly taskClient: TaskGrpcClient) { }

  @Public()
  @Query(() => HelloResponse, { description: 'Test task service connectivity' })
  async taskHello(@Args('name', { defaultValue: 'World' }) name: string): Promise<HelloResponse> {
    this.logger.log(`Hello request with name: ${name}`);
    const result = await this.taskClient.hello(name);
    return {
      message: result.message,
    };
  }

  // Placeholder resolvers for future task service implementation
  // Uncomment and implement when task-service adds full CRUD operations

  // @Query(() => Task, { description: 'Get task by ID' })
  // async task(
  //   @Args('id') id: string,
  //   @CurrentUser() currentUser: CurrentUserPayload,
  // ): Promise<Task> {
  //   const result = await this.taskClient.getTask(id, {
  //     userId: currentUser.sub,
  //     tenantId: currentUser.tenantId,
  //     roles: currentUser.roles,
  //   });
  //   return this.mapTask(result.task);
  // }

  // @Query(() => TaskConnection, { description: 'List tasks with pagination' })
  // async tasks(
  //   @Args('input') input: ListTasksInput,
  //   @CurrentUser() currentUser: CurrentUserPayload,
  // ): Promise<TaskConnection> {
  //   const result = await this.taskClient.listTasks(
  //     input.page,
  //     input.pageSize,
  //     { status: input.status, priority: input.priority, assigneeId: input.assigneeId },
  //     {
  //       userId: currentUser.sub,
  //       tenantId: currentUser.tenantId,
  //       roles: currentUser.roles,
  //     },
  //   );
  //   return {
  //     tasks: (result.tasks || []).map((t: any) => this.mapTask(t)),
  //     total: result.total || 0,
  //     page: result.page || input.page,
  //     pageSize: result.page_size || input.pageSize,
  //   };
  // }

  // @Mutation(() => Task, { description: 'Create a new task' })
  // async createTask(
  //   @Args('input') input: CreateTaskInput,
  //   @CurrentUser() currentUser: CurrentUserPayload,
  // ): Promise<Task> {
  //   const result = await this.taskClient.createTask(
  //     {
  //       tenant_id: currentUser.tenantId,
  //       title: input.title,
  //       description: input.description,
  //       priority: input.priority,
  //       assignee_id: input.assigneeId,
  //       due_date: input.dueDate,
  //     },
  //     {
  //       userId: currentUser.sub,
  //       tenantId: currentUser.tenantId,
  //       roles: currentUser.roles,
  //     },
  //   );
  //   return this.mapTask(result.task);
  // }

  // @Mutation(() => Task, { description: 'Update task' })
  // async updateTask(
  //   @Args('id') id: string,
  //   @Args('input') input: UpdateTaskInput,
  //   @CurrentUser() currentUser: CurrentUserPayload,
  // ): Promise<Task> {
  //   const result = await this.taskClient.updateTask(
  //     {
  //       task_id: id,
  //       ...input,
  //     },
  //     {
  //       userId: currentUser.sub,
  //       tenantId: currentUser.tenantId,
  //       roles: currentUser.roles,
  //     },
  //   );
  //   return this.mapTask(result.task);
  // }

  // @Mutation(() => OperationResponse, { description: 'Delete task' })
  // async deleteTask(
  //   @Args('id') id: string,
  //   @CurrentUser() currentUser: CurrentUserPayload,
  // ): Promise<OperationResponse> {
  //   const result = await this.taskClient.deleteTask(id, {
  //     userId: currentUser.sub,
  //     tenantId: currentUser.tenantId,
  //     roles: currentUser.roles,
  //   });
  //   return {
  //     success: result.success,
  //     message: result.message,
  //   };
  // }

  // private mapTask(grpcTask: any): Task {
  //   if (!grpcTask) {
  //     throw new Error('Task not found');
  //   }
  //   return {
  //     id: grpcTask.id,
  //     tenantId: grpcTask.tenant_id,
  //     title: grpcTask.title,
  //     description: grpcTask.description,
  //     status: grpcTask.status,
  //     priority: grpcTask.priority,
  //     assigneeId: grpcTask.assignee_id,
  //     dueDate: grpcTask.due_date,
  //     createdBy: grpcTask.created_by,
  //     createdAt: grpcTask.created_at,
  //     updatedAt: grpcTask.updated_at,
  //   };
  // }
}
