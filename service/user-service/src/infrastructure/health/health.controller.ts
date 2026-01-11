import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  async check() {
    const dbState = this.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      database: {
        state: states[dbState],
        host: this.connection.host,
        port: this.connection.port,
        name: this.connection.name,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  async checkDatabase() {
    try {
      const dbState = this.connection.readyState;

      if (dbState !== 1) {
        return {
          status: 'unhealthy',
          message: 'Database connection is not ready',
          state: dbState,
        };
      }

      // Test actual database query
      await this.connection.db.admin().ping();

      // Get connection pool stats (using any to access internal MongoDB driver)
      const connectionAny = this.connection as any;
      const poolStats = {
        availableConnections: connectionAny.client?.topology?.s?.pool?.availableConnectionCount || 'N/A',
        totalConnections: connectionAny.client?.topology?.s?.pool?.totalConnectionCount || 'N/A',
        pendingOperations: connectionAny.client?.topology?.s?.pool?.waitQueueSize || 'N/A',
      };

      return {
        status: 'healthy',
        message: 'Database is connected and responsive',
        connection: {
          host: this.connection.host,
          port: this.connection.port,
          database: this.connection.name,
          readyState: dbState,
        },
        pool: poolStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: 'Database health check failed',
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('ready')
  async ready() {
    const dbState = this.connection.readyState;

    if (dbState === 1) {
      return {
        ready: true,
        message: 'Service is ready',
      };
    }

    return {
      ready: false,
      message: 'Service is not ready',
      reason: 'Database connection not established',
    };
  }

  @Get('live')
  async live() {
    return {
      alive: true,
      message: 'Service is alive',
      timestamp: new Date().toISOString(),
    };
  }
}
