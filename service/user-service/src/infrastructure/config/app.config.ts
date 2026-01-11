import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  environment: string;
  serviceName: string;
  grpcPort: number;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT || '3001', 10),
    environment: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'user-service',
    grpcPort: parseInt(process.env.GRPC_PORT || '50051', 10),
  }),
);
