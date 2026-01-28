import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';
import { CreateTaskInput } from '../../presentation/graphql/inputs/task.input';

@Injectable()
export class CreateTaskUseCase {
    private readonly logger = new Logger(CreateTaskUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(input: CreateTaskInput, context: { userId: string; tenantId: string; roles: string[]; scopes: string[] }) {
        this.logger.log(`Executing CreateTaskUseCase for tenant: ${context.tenantId} by user: ${context.userId}`);

        const payload = {
            tenant_id: context.tenantId,
            creator_id: context.userId,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            assignee_ids: input.assigneeIds || [],
            watcher_ids: input.watcherIds || [],
            project_id: input.projectId,
            space_id: input.spaceId,
            parent_task_id: input.parentTaskId,
            due_date: input.dueDate,
            start_date: input.startDate,
            time_estimate_minutes: input.timeEstimateMinutes,
            tags: input.tags || [],
        };

        this.logger.log(`gRPC Payload: ${JSON.stringify(payload)}`);

        const result = await this.taskClient.createTask(payload, context);

        return result.task;
    }
}
