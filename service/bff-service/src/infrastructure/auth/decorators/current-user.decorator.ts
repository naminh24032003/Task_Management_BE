import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface CurrentUserPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, context: ExecutionContext): CurrentUserPayload | any => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user = request.user as CurrentUserPayload;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
