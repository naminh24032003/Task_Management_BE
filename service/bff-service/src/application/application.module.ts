import { Module } from '@nestjs/common';
import { GrpcModule } from '../infrastructure/grpc/grpc.module';
import { RegisterUseCase } from './user/register.usecase';
import { LoginUseCase } from './user/login.usecase';
import { CreateTaskUseCase } from './task/create-task.usecase';
import { GetTaskUseCase } from './task/get-task.usecase';
import { ListTasksUseCase } from './task/list-tasks.usecase';
import { UpdateTaskUseCase } from './task/update-task.usecase';
import { DeleteTaskUseCase } from './task/delete-task.usecase';
import { UpdateTaskStatusUseCase } from './task/update-task-status.usecase';
import { AssignTaskUseCase } from './task/assign-task.usecase';
import { BulkUpdateStatusUseCase } from './task/bulk-update-status.usecase';

const USER_USE_CASES = [RegisterUseCase, LoginUseCase];
const TASK_USE_CASES = [
    CreateTaskUseCase,
    GetTaskUseCase,
    ListTasksUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
    UpdateTaskStatusUseCase,
    AssignTaskUseCase,
    BulkUpdateStatusUseCase,
];

@Module({
    imports: [GrpcModule],
    providers: [...USER_USE_CASES, ...TASK_USE_CASES],
    exports: [...USER_USE_CASES, ...TASK_USE_CASES],
})
export class ApplicationModule { }
