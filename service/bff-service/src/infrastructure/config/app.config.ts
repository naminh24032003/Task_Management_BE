import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT || '4000', 10),
  metricsPort: parseInt(process.env.APP_METRICS_PORT || '9092', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
}));
