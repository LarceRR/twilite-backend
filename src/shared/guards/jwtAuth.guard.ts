import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TokenService } from '@/modules/auth/application/services/token.service';
import { AuthenticationError } from '@/shared/errors';

import { IS_PUBLIC, type RequestWithUser } from '../decorators/auth.decorators';

/**
 * Applied globally: a new controller is protected unless it says otherwise, which
 * is the safe default for an app where every route is user-scoped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new AuthenticationError('Отсутствует токен доступа');
    }

    const payload = await this.tokens.verifyAccessToken(header.slice('Bearer '.length));

    request.user = { userId: payload.userId, sessionId: payload.sessionId };

    return true;
  }
}
