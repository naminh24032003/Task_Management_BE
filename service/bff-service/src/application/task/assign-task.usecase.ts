import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';

@Injectable()
export class AssignTaskUseCase {
    private readonly logger = new Logger(AssignTaskUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(id: string, assigneeIds: string[], context: { userId: string; tenantId: string; roles: string[]; scopes: string[] }) {
        this.logger.log(`Executing AssignTaskUseCase for id: ${id} with ${assigneeIds.length} assignees`);

        const result = await this.taskClient.assignTask({
            id: id,
            tenant_id: context.tenantId,
            assignee_ids: assigneeIds,
            assigned_by: context.userId,
        }, context);

        return result.task;
    }
}
