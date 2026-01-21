import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Task service hello response' })
export class HelloResponse {
  @Field({ description: 'Hello message' })
  message: string;
}

// Placeholder types for future task service implementation
// Uncomment and extend when task-service adds full CRUD operations

// export enum TaskStatus {
//   TODO = 'TODO',
//   IN_PROGRESS = 'IN_PROGRESS',
//   DONE = 'DONE',
//   CANCELLED = 'CANCELLED',
// }

// export enum TaskPriority {
//   LOW = 'LOW',
//   MEDIUM = 'MEDIUM',
//   HIGH = 'HIGH',
//   URGENT = 'URGENT',
// }

// @ObjectType({ description: 'Task entity' })
// export class Task {
//   @Field(() => ID, { description: 'Task unique identifier' })
//   id: string;

//   @Field({ description: 'Tenant identifier' })
//   tenantId: string;

//   @Field({ description: 'Task title' })
//   title: string;

//   @Field({ nullable: true, description: 'Task description' })
//   description?: string;

//   @Field(() => TaskStatus, { description: 'Task status' })
//   status: TaskStatus;

//   @Field(() => TaskPriority, { description: 'Task priority' })
//   priority: TaskPriority;

//   @Field({ nullable: true, description: 'Assigned user ID' })
//   assigneeId?: string;

//   @Field({ nullable: true, description: 'Due date' })
//   dueDate?: string;

//   @Field({ description: 'Creator user ID' })
//   createdBy: string;

//   @Field({ description: 'Creation timestamp' })
//   createdAt: string;

//   @Field({ description: 'Last update timestamp' })
//   updatedAt: string;
// }

// @ObjectType({ description: 'Paginated task list response' })
// export class TaskConnection {
//   @Field(() => [Task], { description: 'List of tasks' })
//   tasks: Task[];

//   @Field(() => Int, { description: 'Total count of tasks' })
//   total: number;

//   @Field(() => Int, { description: 'Current page number' })
//   page: number;

//   @Field(() => Int, { description: 'Page size' })
//   pageSize: number;
// }
