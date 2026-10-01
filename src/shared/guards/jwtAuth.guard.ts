import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/modules/auth/domain/repositories/SessionRepository';
import { readAccessToken } from '@/modules/auth/application/services/sessionCookies';
import { TokenService } from '@/modules/auth/application/services/token.service';
import { AuthenticationError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import { IS_PUBLIC, type RequestWithUser } from '../decorators/auth.decorators';

/**
 * Applied globally: a new controller is protected unless it says otherwise, which
 * is the safe default for an app where every route is user-scoped.
 *
 * Web sessions live in httpOnly cookies. Native apps still send Bearer.
 * A valid JWT is not enough: the session row must still be active.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
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
    const token = readAccessToken(request as FastifyRequest);

    if (token === null) {
      throw new AuthenticationError('Отсутствует токен доступа');
    }

    const payload = await this.tokens.verifyAccessToken(token);
    const session = await this.sessions.findById(payload.sessionId);

    if (
      session === null ||
      session.revokedAt !== null ||
      session.userId !== payload.userId ||
      session.expiresAt.getTime() <= this.clock.now().getTime()
    ) {
      throw new AuthenticationError('Сессия недействительна');
    }

    request.user = { userId: payload.userId, sessionId: payload.sessionId };

    return true;
  }
}
