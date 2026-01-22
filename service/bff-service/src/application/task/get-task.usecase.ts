import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';

@Injectable()
export class GetTaskUseCase {
    private readonly logger = new Logger(GetTaskUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(id: string, context: { userId: string; tenantId: string; roles: string[] }) {
        this.logger.log(`Executing GetTaskUseCase for id: ${id} in tenant: ${context.tenantId}`);

        const result = await this.taskClient.getTask(id, context);
        return result.task;
    }
}
