import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * UnifiedAuthGuard - Supports both Kong mode and Standalone mode
 *
 * Kong Mode (AUTH_MODE=kong):
 * - Trusts Kong's JWT validation
 * - Extracts identity from Kong-injected headers (x-user-id, x-tenant-id, etc.)
 * - No JWT validation in BFF
 *
 * Standalone Mode (AUTH_MODE=standalone):
 * - BFF validates JWT directly
 * - Used when BFF is not behind Kong (e.g., development, parallel deployment)
 */
@Injectable()
export class UnifiedAuthGuard implements CanActivate {
  private readonly logger = new Logger(UnifiedAuthGuard.name);
  private readonly authMode: string;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    this.authMode = this.configService.get<string>('auth.mode', 'kong');
    this.logger.log(`Auth mode: ${this.authMode}`);
  }

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

    if (this.authMode === 'kong') {
      return this.validateKongHeaders(req);
    } else {
      return this.validateJwt(req);
    }
  }

  /**
   * Kong Mode: Extract identity from Kong-injected headers
   */
  private validateKongHeaders(req: any): boolean {
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];
    const email = req.headers['x-email'];
    const rolesHeader = req.headers['x-roles'];
    const scopesHeader = req.headers['x-scopes'];

    if (!userId) {
      this.logger.warn('Request without x-user-id header');
      throw new UnauthorizedException('Not authenticated');
    }

    const roles = rolesHeader
      ? rolesHeader.split(',').map((r: string) => r.trim()).filter(Boolean)
      : [];
    const scopes = scopesHeader
      ? scopesHeader.split(',').map((p: string) => p.trim()).filter(Boolean)
      : [];

    req.user = {
      sub: userId,
      tenantId: tenantId || '',
      email: email || '',
      roles,
      scopes,
    };

    return true;
  }

  /**
   * Standalone Mode: Validate JWT directly
   */
  private validateJwt(req: any): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = parts[1];

    try {
      const jwtSecret = this.configService.get<string>('auth.jwtSecret');
      if (!jwtSecret) {
        throw new UnauthorizedException('Server configuration error');
      }

      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded.type && decoded.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      req.user = {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        roles: decoded.roles || [],
        scopes: decoded.scopes || [],
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
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
