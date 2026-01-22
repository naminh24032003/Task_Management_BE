import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsArray, IsInt, Min } from 'class-validator';
import { TaskStatus, TaskPriority } from '../types/task.type';

@InputType()
export class CreateTaskInput {
    @Field()
    @IsString()
    title: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    description?: string;

    @Field(() => TaskStatus, { defaultValue: TaskStatus.OPEN })
    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;

    @Field(() => TaskPriority, { defaultValue: TaskPriority.NORMAL })
    @IsEnum(TaskPriority)
    @IsOptional()
    priority?: TaskPriority;

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assigneeIds?: string[];

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    watcherIds?: string[];

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    projectId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    spaceId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    parentTaskId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    dueDate?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    startDate?: string;

    @Field(() => Int, { nullable: true })
    @IsInt()
    @Min(0)
    @IsOptional()
    timeEstimateMinutes?: number;

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}

@InputType()
export class UpdateTaskInput {
    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    title?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    description?: string;

    @Field(() => TaskStatus, { nullable: true })
    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;

    @Field(() => TaskPriority, { nullable: true })
    @IsEnum(TaskPriority)
    @IsOptional()
    priority?: TaskPriority;

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assigneeIds?: string[];

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    projectId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    dueDate?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    startDate?: string;

    @Field(() => Int, { nullable: true })
    @IsInt()
    @Min(0)
    @IsOptional()
    timeEstimateMinutes?: number;

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}

@InputType()
export class TaskFiltersInput {
    @Field(() => [TaskStatus], { nullable: true })
    @IsArray()
    @IsEnum(TaskStatus, { each: true })
    @IsOptional()
    statuses?: TaskStatus[];

    @Field(() => [TaskPriority], { nullable: true })
    @IsArray()
    @IsEnum(TaskPriority, { each: true })
    @IsOptional()
    priorities?: TaskPriority[];

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assigneeIds?: string[];

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    creatorId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    projectId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    spaceId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    parentTaskId?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    dueDateBefore?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    dueDateAfter?: string;

    @Field({ nullable: true })
    @IsString()
    @IsOptional()
    search?: string;

    @Field(() => [String], { nullable: true })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}

@InputType()
export class ListTasksInput {
    @Field(() => Int, { defaultValue: 1 })
    @IsInt()
    @Min(1)
    page: number;

    @Field(() => Int, { defaultValue: 20 })
    @IsInt()
    @Min(1)
    pageSize: number;

    @Field(() => TaskFiltersInput, { nullable: true })
    @IsOptional()
    filters?: TaskFiltersInput;
}

@InputType()
export class BulkUpdateStatusInput {
    @Field(() => [String])
    @IsArray()
    @IsString({ each: true })
    taskIds: string[];

    @Field(() => TaskStatus)
    @IsEnum(TaskStatus)
    status: TaskStatus;
}
