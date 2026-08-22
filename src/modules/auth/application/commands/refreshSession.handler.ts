import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { AuthSessionDto } from '@/shared/contracts/auth.contract';
import { AuthenticationError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/repositories/SessionRepository';
import { TokenService } from '../services/token.service';

@Injectable()
export class RefreshSessionHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Refresh rotation: one refresh token works exactly once. A replayed token no
   * longer matches the stored hash, so a stolen token is useless after the real
   * client refreshes.
   */
  async execute(refreshToken: string): Promise<AuthSessionDto> {
    const { sessionId, hash } = this.tokens.parseRefreshToken(refreshToken);
    const session = await this.sessions.findById(sessionId);

    if (session === null || session.revokedAt !== null) {
      throw new AuthenticationError('Сессия недействительна');
    }

    if (session.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new AuthenticationError('Сессия истекла');
    }

    if (!hashesMatch(session.refreshTokenHash, hash)) {
      // A mismatch means the token was reused: drop every session of this user.
      await this.sessions.revokeAllForUser(session.userId);
      throw new AuthenticationError('Refresh-токен уже был использован');
    }

    const nextRefreshToken = this.tokens.createRefreshToken(session.id);
    await this.sessions.rotate(
      session.id,
      this.tokens.hashRefreshToken(nextRefreshToken),
      this.tokens.refreshExpiry(),
    );

    const access = await this.tokens.issueAccessToken({
      userId: session.userId,
      sessionId: session.id,
    });

    return {
      accessToken: access.token,
      refreshToken: nextRefreshToken,
      expiresAt: access.expiresAt.toISOString(),
      userId: session.userId,
    };
  }
}

function hashesMatch(stored: string, provided: string): boolean {
  const storedBuffer = Buffer.from(stored, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  return (
    storedBuffer.length === providedBuffer.length && timingSafeEqual(storedBuffer, providedBuffer)
  );
}
