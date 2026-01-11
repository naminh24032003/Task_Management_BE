import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../../config/database.config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database');

        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }

        return {
          uri: dbConfig.uri,
          dbName: dbConfig.dbName,
          // Connection Pool Configuration
          minPoolSize: dbConfig.poolSize.min,
          maxPoolSize: dbConfig.poolSize.max,
          maxIdleTimeMS: dbConfig.maxIdleTime,
          waitQueueTimeoutMS: dbConfig.waitQueueTimeout,

          // Timeout Configuration
          socketTimeoutMS: dbConfig.socketTimeout,
          serverSelectionTimeoutMS: dbConfig.serverSelectionTimeout,
          heartbeatFrequencyMS: dbConfig.heartbeatFrequency,

          // Retry Configuration
          retryWrites: dbConfig.retryWrites,
          retryReads: dbConfig.retryReads,

          // Compression
          compressors: dbConfig.compressors as ('none' | 'snappy' | 'zlib' | 'zstd')[],

          // Read/Write Concerns
          readPreference: dbConfig.readPreference as any,
          readConcern: dbConfig.readConcern as any,
          writeConcern: {
            w: dbConfig.writeConcern.w as any,
            wtimeout: dbConfig.writeConcern.wtimeout,
            journal: dbConfig.writeConcern.journal,
          },

          // Schema Options
          autoIndex: dbConfig.autoIndex,
          autoCreate: dbConfig.autoCreate,

          // Connection Options
          directConnection: false, // Important for sharded clusters

          // Additional Options for Production
          maxConnecting: 10, // Maximum number of connections being established at the same time

          // Connection Events
          connectionFactory: (connection: any) => {
            connection.on('connected', () => {
              console.log('MongoDB connected successfully');
            });

            connection.on('error', (err: Error) => {
              console.error('MongoDB connection error:', err);
            });

            connection.on('disconnected', () => {
              console.warn('MongoDB disconnected');
            });

            connection.on('reconnected', () => {
              console.log('MongoDB reconnected');
            });

            return connection;
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class MongoDbModule {}
