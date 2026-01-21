import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  type?: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format. Expected: Bearer <token>');
    }

    const token = parts[1];

    try {
      const jwtSecret = this.configService.get<string>('auth.jwtSecret');
      if (!jwtSecret) {
        this.logger.error('JWT secret is not configured');
        throw new UnauthorizedException('Server configuration error');
      }

      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Check token type (should be 'access' or undefined for legacy tokens)
      if (decoded.type && decoded.type !== 'access') {
        throw new UnauthorizedException('Invalid token type. Expected access token');
      }

      // Attach user payload to request
      req.user = {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
      };

      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Token validation failed', error);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
