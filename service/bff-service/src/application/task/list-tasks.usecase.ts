import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';
import { ListTasksInput } from '../../presentation/graphql/inputs/task.input';

@Injectable()
export class ListTasksUseCase {
    private readonly logger = new Logger(ListTasksUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(input: ListTasksInput, context: { userId: string; tenantId: string; roles: string[]; scopes: string[] }) {
        this.logger.log(`Executing ListTasksUseCase for tenant: ${context.tenantId}`);

        // Convert filter keys to match gRPC request if necessary
        const filters = input.filters ? {
            statuses: input.filters.statuses,
            priorities: input.filters.priorities,
            assignee_ids: input.filters.assigneeIds,
            creator_id: input.filters.creatorId,
            project_id: input.filters.projectId,
            space_id: input.filters.spaceId,
            parent_task_id: input.filters.parentTaskId,
            due_date_before: input.filters.dueDateBefore,
            due_date_after: input.filters.dueDateAfter,
            search: input.filters.search,
            tags: input.filters.tags,
        } : {};

        const result = await this.taskClient.listTasks({
            tenant_id: context.tenantId,
            page: input.page,
            page_size: input.pageSize,
            filters: filters,
        }, context);

        return result;
    }
}
