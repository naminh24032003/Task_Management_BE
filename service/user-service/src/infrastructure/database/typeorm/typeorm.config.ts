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
    synchronize: process.env.NODE_ENV !== 'production', // Auto-create collections in dev
    logging: process.env.NODE_ENV === 'development',

    // Connection pool settings
    extra: {
      minPoolSize: parseInt(process.env.MONGODB_POOL_MIN || '10', 10),
      maxPoolSize: parseInt(process.env.MONGODB_POOL_MAX || '100', 10),
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10),
      serverSelectionTimeoutMS: parseInt(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '30000',
        10,
      ),
      heartbeatFrequencyMS: parseInt(
        process.env.MONGODB_HEARTBEAT_FREQUENCY || '10000',
        10,
      ),
      maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME || '600000', 10),
      waitQueueTimeoutMS: parseInt(
        process.env.MONGODB_WAIT_QUEUE_TIMEOUT || '10000',
        10,
      ),
      retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
      retryReads: process.env.MONGODB_RETRY_READS !== 'false',
      compression: {
        compressors: (process.env.MONGODB_COMPRESSORS || 'snappy,zlib').split(','),
      },
      readPreference: process.env.MONGODB_READ_PREFERENCE || 'primaryPreferred',
      readConcern: {
        level: process.env.MONGODB_READ_CONCERN || 'majority',
      },
      writeConcern: {
        w: process.env.MONGODB_WRITE_CONCERN_W || 'majority',
        wtimeout: parseInt(
          process.env.MONGODB_WRITE_CONCERN_WTIMEOUT || '5000',
          10,
        ),
        journal: process.env.MONGODB_WRITE_CONCERN_JOURNAL !== 'false',
      },
    },
  }),
);
