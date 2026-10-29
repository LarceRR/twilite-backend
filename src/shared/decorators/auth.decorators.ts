import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthenticationError } from '@/shared/errors';

export const IS_PUBLIC = 'auth:isPublic';

/** Routes are authenticated by default; opting out has to be explicit. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export type AuthenticatedUser = {
  readonly userId: UserId;
  readonly sessionId: string;
};

export type RequestWithUser = FastifyRequest & { user?: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user === undefined) {
      throw new AuthenticationError('Требуется авторизация');
    }

    return request.user;
  },
);
