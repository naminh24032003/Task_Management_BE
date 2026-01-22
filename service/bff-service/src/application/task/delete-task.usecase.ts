import { Injectable, Logger } from '@nestjs/common';
import { TaskGrpcClient } from '../../infrastructure/grpc/clients/task.client';

@Injectable()
export class DeleteTaskUseCase {
    private readonly logger = new Logger(DeleteTaskUseCase.name);

    constructor(private readonly taskClient: TaskGrpcClient) { }

    async execute(id: string, context: { userId: string; tenantId: string; roles: string[] }) {
        this.logger.log(`Executing DeleteTaskUseCase for id: ${id} in tenant: ${context.tenantId}`);

        const result = await this.taskClient.deleteTask(id, context);
        return result;
    }
}
