import { Controller, Get } from '@nestjs/common';

interface HealthCheck {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
}

@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  @Get('health')
  getHealth(): HealthCheck {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      service: 'bff-service',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Get('healthz')
  getHealthz(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  getReady(): { status: string } {
    return { status: 'ok' };
  }
}
