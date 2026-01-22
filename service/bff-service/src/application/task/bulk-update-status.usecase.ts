import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';
import { BulkUpdateStatusInput } from '../../presentation/graphql/inputs/task.input';

@Injectable()
export class BulkUpdateStatusUseCase {
    private readonly logger = new Logger(BulkUpdateStatusUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(input: BulkUpdateStatusInput, context: { userId: string; tenantId: string; roles: string[] }) {
        this.logger.log(`Executing BulkUpdateStatusUseCase for ${input.taskIds.length} tasks`);

        const result = await this.taskClient.bulkUpdateStatus({
            task_ids: input.taskIds,
            tenant_id: context.tenantId,
            status: input.status,
        }, context);

        return result;
    }
}
