import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  poolSize: {
    min: number;
    max: number;
  };
  socketTimeout: number;
  serverSelectionTimeout: number;
  heartbeatFrequency: number;
  maxIdleTime: number;
  waitQueueTimeout: number;
  retryWrites: boolean;
  retryReads: boolean;
  compressors: string[];
  readPreference: string;
  readConcern: string;
  writeConcern: {
    w: string | number;
    wtimeout: number;
    journal: boolean;
  };
  autoIndex: boolean;
  autoCreate: boolean;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    uri:
      process.env.MONGODB_URI ||
      'mongodb://root:password123@mongodb-sharded.mongodb-sharded.svc.cluster.local:27017/user-service?authSource=admin',
    dbName: process.env.MONGODB_DATABASE || 'user-service',
    poolSize: {
      min: parseInt(process.env.MONGODB_POOL_MIN || '10', 10),
      max: parseInt(process.env.MONGODB_POOL_MAX || '100', 10),
    },
    socketTimeout: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10),
    serverSelectionTimeout: parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '30000',
      10,
    ),
    heartbeatFrequency: parseInt(
      process.env.MONGODB_HEARTBEAT_FREQUENCY || '10000',
      10,
    ),
    maxIdleTime: parseInt(process.env.MONGODB_MAX_IDLE_TIME || '600000', 10), // 10 minutes
    waitQueueTimeout: parseInt(
      process.env.MONGODB_WAIT_QUEUE_TIMEOUT || '10000',
      10,
    ),
    retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
    retryReads: process.env.MONGODB_RETRY_READS !== 'false',
    compressors: (process.env.MONGODB_COMPRESSORS || 'snappy,zlib').split(','),
    readPreference: process.env.MONGODB_READ_PREFERENCE || 'primaryPreferred',
    readConcern: process.env.MONGODB_READ_CONCERN || 'majority',
    writeConcern: {
      w: process.env.MONGODB_WRITE_CONCERN_W || 'majority',
      wtimeout: parseInt(
        process.env.MONGODB_WRITE_CONCERN_WTIMEOUT || '5000',
        10,
      ),
      journal: process.env.MONGODB_WRITE_CONCERN_JOURNAL !== 'false',
    },
    autoIndex: process.env.NODE_ENV !== 'production',
    autoCreate: process.env.NODE_ENV !== 'production',
  }),
);
