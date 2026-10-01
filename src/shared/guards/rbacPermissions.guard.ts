import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { EffectivePermissionsService } from '@/modules/rbac/application/services/effectivePermissions.service';
import { AuthorizationError } from '@/shared/errors';

import { IS_PUBLIC, type RequestWithUser } from '../decorators/auth.decorators';
import { RBAC_REQUIRE_ALL, RBAC_REQUIRE_ANY } from '../decorators/rbac.decorators';

/**
 * Global platform RBAC guard. Runs after JwtAuthGuard.
 * Routes without RBAC metadata are allowed (public routes skip via IS_PUBLIC).
 * Platform RBAC metadata is optional and mainly used by admin routes.
 */
@Injectable()
export class RbacPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly effective: EffectivePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const requireAll = this.reflector.getAllAndOverride<string[] | undefined>(RBAC_REQUIRE_ALL, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireAny = this.reflector.getAllAndOverride<string[] | undefined>(RBAC_REQUIRE_ANY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      (requireAll === undefined || requireAll.length === 0) &&
      (requireAny === undefined || requireAny.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.userId;

    if (userId === undefined) {
      throw new AuthorizationError('Требуется авторизация');
    }

    if (requireAll !== undefined && requireAll.length > 0) {
      const ok = await this.effective.hasAllPermissions(userId, requireAll);

      if (!ok) {
        throw new AuthorizationError('Недостаточно прав');
      }
    }

    if (requireAny !== undefined && requireAny.length > 0) {
      const ok = await this.effective.hasAnyPermission(userId, requireAny);

      if (!ok) {
        throw new AuthorizationError('Недостаточно прав');
      }
    }

    return true;
  }
}
