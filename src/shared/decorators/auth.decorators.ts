import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { SpacePermission } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthenticationError } from '@/shared/errors';

export const IS_PUBLIC = 'auth:isPublic';
export const REQUIRED_PERMISSION = 'auth:requiredPermission';

/** Routes are authenticated by default; opting out has to be explicit. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Declares the space permission a route needs. `SpacePermissionGuard` resolves the
 * space from the route params and enforces it before the handler runs.
 */
export const RequirePermission = (permission: SpacePermission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

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
