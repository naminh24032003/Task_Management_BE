import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';
import { TaskStatus } from '../../presentation/graphql/types/task.type';

@Injectable()
export class UpdateTaskStatusUseCase {
    private readonly logger = new Logger(UpdateTaskStatusUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(id: string, status: TaskStatus, context: { userId: string; tenantId: string; roles: string[]; scopes: string[] }) {
        this.logger.log(`Executing UpdateTaskStatusUseCase for id: ${id} to status: ${status}`);

        const result = await this.taskClient.updateTaskStatus({
            id: id,
            tenant_id: context.tenantId,
            status: status,
        }, context);

        return result.task;
    }
}
