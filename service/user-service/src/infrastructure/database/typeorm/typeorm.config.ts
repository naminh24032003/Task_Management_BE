import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Tenant } from './entities/tenant.entity';

export type TypeOrmConfig = TypeOrmModuleOptions;

export default registerAs(
  'typeorm',
  (): TypeOrmConfig => ({
    type: 'mongodb',
    url:
      process.env.MONGODB_URI ||
      'mongodb://root:MongoDB@Root2024Secure!@localhost:27017/user-service?authSource=admin',
    database: process.env.MONGODB_DATABASE || 'user-service',
    entities: [User, Role, Permission, Tenant],
    synchronize: false, // Disabled to avoid index conflicts
    logging: process.env.NODE_ENV === 'development',

    // Connection pool settings - simplified for sharded cluster
    extra: {
      minPoolSize: parseInt(process.env.MONGODB_POOL_MIN || '5', 10),
      maxPoolSize: parseInt(process.env.MONGODB_POOL_MAX || '50', 10),
      serverSelectionTimeoutMS: parseInt(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '30000',
        10,
      ),
      directConnection: false,
    },
  }),
);
