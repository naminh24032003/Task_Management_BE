import { registerAs } from '@nestjs/config';

export default registerAs('grpc', () => ({
  userService: {
    url: process.env.GRPC_USER_SERVICE_URL || 'localhost:50051',
  },
  taskService: {
    url: process.env.GRPC_TASK_SERVICE_URL || 'localhost:50052',
  },
}));
