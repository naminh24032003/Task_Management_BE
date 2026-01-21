import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  // Auth mode: 'kong' (behind Kong, trust headers) or 'standalone' (validate JWT)
  mode: process.env.AUTH_MODE || 'kong',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN || '3600', 10),
}));
