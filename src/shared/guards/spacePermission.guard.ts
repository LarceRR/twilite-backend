import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type {
  SpaceId,
  SpacePermission,
} from '@/modules/spaces/domain/value-objects/SpacePermission';
import { AuthenticationError, ValidationError } from '@/shared/errors';

import { REQUIRED_PERMISSION, type RequestWithUser } from '../decorators/auth.decorators';

/**
 * Step 3 of the shared-space flow, enforced by the framework instead of by
 * convention: a mutating route cannot forget to check permissions.
 */
@Injectable()
export class SpacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: SpaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<SpacePermission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );

    if (permission === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user === undefined) {
      throw new AuthenticationError('Требуется авторизация');
    }

    const spaceId = this.resolveSpaceId(request);

    await this.access.assertPermission(spaceId, request.user.userId, permission);

    return true;
  }

  private resolveSpaceId(request: RequestWithUser): SpaceId {
    const params = request.params as Record<string, string | undefined> | undefined;
    const spaceId = params?.['spaceId'];

    if (spaceId === undefined || spaceId.length === 0) {
      throw new ValidationError('В маршруте отсутствует spaceId');
    }

    return spaceId as SpaceId;
  }
}
