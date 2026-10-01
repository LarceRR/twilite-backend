import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

import { EffectivePermissionsService } from '@/modules/rbac/application/services/effectivePermissions.service';
import { AuthorizationError } from '@/shared/errors';

import type { RequestWithUser } from '../decorators/auth.decorators';

@Injectable()
export class AdminPanelGuard implements CanActivate {
  constructor(private readonly effective: EffectivePermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.userId;

    if (userId === undefined) {
      throw new AuthorizationError('Требуется авторизация');
    }

    const ok = await this.effective.hasPermission(userId, 'ta.adminPanel.access');

    if (!ok) {
      throw new AuthorizationError('Нет доступа к админ-панели');
    }

    return true;
  }
}
