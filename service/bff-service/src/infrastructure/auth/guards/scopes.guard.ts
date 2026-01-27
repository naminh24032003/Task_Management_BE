import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredScopes || requiredScopes.length === 0) {
            return true;
        }

        const ctx = GqlExecutionContext.create(context);
        const { req } = ctx.getContext();
        const user = req.user as CurrentUserPayload;

        if (!user || !user.scopes) {
            throw new ForbiddenException('Missing user scopes');
        }

        const hasScope = requiredScopes.some((scope) => user.scopes.includes(scope));
        if (!hasScope) {
            throw new ForbiddenException(`Missing required scope: ${requiredScopes.join(', ')}`);
        }

        return true;
    }
}
