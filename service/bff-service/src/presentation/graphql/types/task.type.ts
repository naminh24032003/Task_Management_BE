import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

export enum TaskStatus {
  UNSPECIFIED = 'TASK_STATUS_UNSPECIFIED',
  OPEN = 'TASK_STATUS_OPEN',
  IN_PROGRESS = 'TASK_STATUS_IN_PROGRESS',
  BLOCKED = 'TASK_STATUS_BLOCKED',
  REVIEW = 'TASK_STATUS_REVIEW',
  COMPLETE = 'TASK_STATUS_COMPLETE',
  CLOSED = 'TASK_STATUS_CLOSED',
  CANCELLED = 'TASK_STATUS_CANCELLED',
}

registerEnumType(TaskStatus, {
  name: 'TaskStatus',
  description: 'The status of the task',
});

export enum TaskPriority {
  UNSPECIFIED = 'TASK_PRIORITY_UNSPECIFIED',
  LOW = 'TASK_PRIORITY_LOW',
  NORMAL = 'TASK_PRIORITY_NORMAL',
  HIGH = 'TASK_PRIORITY_HIGH',
  URGENT = 'TASK_PRIORITY_URGENT',
}

registerEnumType(TaskPriority, {
  name: 'TaskPriority',
  description: 'The priority of the task',
});

@ObjectType({ description: 'Task service hello response' })
export class HelloResponse {
  @Field({ description: 'Hello message' })
  message: string;
}

@ObjectType({ description: 'Task entity' })
export class Task {
  @Field(() => ID)
  id: string;

  @Field()
  tenantId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TaskStatus)
  status: TaskStatus;

  @Field(() => TaskPriority)
  priority: TaskPriority;

  @Field(() => [String], { defaultValue: [] })
  assigneeIds: string[];

  @Field(() => [String], { defaultValue: [] })
  watcherIds: string[];

  @Field()
  creatorId: string;

  @Field({ nullable: true })
  projectId?: string;

  @Field({ nullable: true })
  spaceId?: string;

  @Field({ nullable: true })
  parentTaskId?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field({ nullable: true })
  dueDate?: string;

  @Field({ nullable: true })
  startDate?: string;

  @Field({ nullable: true })
  completedAt?: string;

  @Field(() => Int, { nullable: true })
  timeEstimateMinutes?: number;

  @Field(() => Int, { defaultValue: 0 })
  timeTrackedMinutes: number;

  @Field(() => [String], { defaultValue: [] })
  tags: string[];

  @Field(() => [String], { defaultValue: [] })
  dependencyIds: string[];

  @Field(() => Int, { defaultValue: 0 })
  orderIndex: number;
}

@ObjectType()
export class TaskConnection {
  @Field(() => [Task])
  tasks: Task[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;
}

@ObjectType()
export class TaskOperationResponse {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}
