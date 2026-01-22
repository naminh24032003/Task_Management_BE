import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';
import { UpdateTaskInput } from '../../presentation/graphql/inputs/task.input';

@Injectable()
export class UpdateTaskUseCase {
    private readonly logger = new Logger(UpdateTaskUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(id: string, input: UpdateTaskInput, context: { userId: string; tenantId: string; roles: string[] }) {
        this.logger.log(`Executing UpdateTaskUseCase for id: ${id} in tenant: ${context.tenantId}`);

        const result = await this.taskClient.updateTask({
            id: id,
            tenant_id: context.tenantId,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            assignee_ids: input.assigneeIds,
            project_id: input.projectId,
            due_date: input.dueDate,
            start_date: input.startDate,
            time_estimate_minutes: input.timeEstimateMinutes,
            tags: input.tags,
        }, context);

        return result.task;
    }
}
