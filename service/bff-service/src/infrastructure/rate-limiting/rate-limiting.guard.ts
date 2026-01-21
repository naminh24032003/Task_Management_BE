import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RateLimitingService } from './rate-limiting.service';

@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  constructor(private rateLimitingService: RateLimitingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    // Get user ID if authenticated
    const userId = req.user?.sub;
    const ip = this.getClientIp(req);

    let result;

    if (userId) {
      // Rate limit by user
      result = await this.rateLimitingService.getRateLimitByUser(userId);
    } else {
      // Rate limit by IP for unauthenticated requests
      result = await this.rateLimitingService.getRateLimitByIp(ip);
    }

    // Set rate limit headers (for HTTP response)
    if (req.res) {
      req.res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      req.res.setHeader('X-RateLimit-Reset', result.resetAt.toString());
    }

    if (result.limited) {
      this.logger.warn(
        `Rate limit exceeded for ${userId ? `user ${userId}` : `IP ${ip}`}`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(req: any): string {
    return (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}
