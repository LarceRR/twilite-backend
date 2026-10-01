import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { AuthSessionDto } from '@/shared/contracts/auth.contract';
import { AuthenticationError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import {
  SESSION_REPOSITORY,
  type SessionId,
  type SessionRepository,
} from '../../domain/repositories/SessionRepository';
import { TokenService } from '../services/token.service';

type RefreshGraceRecord = {
  readonly previousHash: string;
  readonly session: AuthSessionDto;
};

const GRACE_WAIT_ATTEMPTS = 12;
const GRACE_WAIT_MS = 25;

/**
 * Refresh rotation with a short reuse-grace window (Auth0-style).
 *
 * One refresh token works once. Concurrent tabs / network retries that replay
 * the previous token within a few seconds receive the same newly issued pair
 * instead of wiping every device. A replay after the grace window still means
 * theft → revoke all sessions for that user.
 */
@Injectable()
export class RefreshSessionHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string): Promise<AuthSessionDto> {
    const { sessionId, hash } = this.tokens.parseRefreshToken(refreshToken);
    const session = await this.sessions.findById(sessionId);

    if (session === null || session.revokedAt !== null) {
      throw new AuthenticationError('Сессия недействительна');
    }

    if (session.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new AuthenticationError('Сессия истекла');
    }

    if (hashesMatch(session.refreshTokenHash, hash)) {
      return this.rotateCurrent(session.id, session.userId, hash);
    }

    const grace = await this.waitForGrace(session.id, hash);

    if (grace !== null) {
      return grace.session;
    }

    // A mismatch outside the grace window means the token was reused after theft.
    await this.sessions.revokeAllForUser(session.userId);
    throw new AuthenticationError('Refresh-токен уже был использован');
  }

  private async rotateCurrent(
    sessionId: SessionId,
    userId: UserId,
    expectedHash: string,
  ): Promise<AuthSessionDto> {
    const nextRefreshToken = this.tokens.createRefreshToken(sessionId);
    const nextHash = this.tokens.hashRefreshToken(nextRefreshToken);
    const rotated = await this.sessions.rotateIfHashMatches(
      sessionId,
      expectedHash,
      nextHash,
      this.tokens.refreshExpiry(),
    );

    if (rotated === null) {
      // Lost the CAS race: another request already rotated. Wait briefly for
      // that winner to publish the grace record before treating this as theft.
      const grace = await this.waitForGrace(sessionId, expectedHash);

      if (grace !== null) {
        return grace.session;
      }

      await this.sessions.revokeAllForUser(userId);
      throw new AuthenticationError('Refresh-токен уже был использован');
    }

    const access = await this.tokens.issueAccessToken({
      userId: rotated.userId,
      sessionId: rotated.id,
    });

    const issued: AuthSessionDto = {
      accessToken: access.token,
      refreshToken: nextRefreshToken,
      expiresAt: access.expiresAt.toISOString(),
      userId: rotated.userId,
    };

    await this.writeGrace(sessionId, {
      previousHash: expectedHash,
      session: issued,
    });

    return issued;
  }

  private async waitForGrace(
    sessionId: SessionId,
    previousHash: string,
  ): Promise<RefreshGraceRecord | null> {
    for (let attempt = 0; attempt < GRACE_WAIT_ATTEMPTS; attempt += 1) {
      const grace = await this.readGrace(sessionId);

      if (grace !== null && hashesMatch(grace.previousHash, previousHash)) {
        return grace;
      }

      if (attempt + 1 < GRACE_WAIT_ATTEMPTS) {
        await sleep(GRACE_WAIT_MS);
      }
    }

    return null;
  }

  private async readGrace(sessionId: SessionId): Promise<RefreshGraceRecord | null> {
    const raw = await this.redis.get(cacheKeys.refreshReuseGrace(sessionId));

    if (raw === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as RefreshGraceRecord;

      if (
        typeof parsed.previousHash !== 'string' ||
        typeof parsed.session?.accessToken !== 'string' ||
        typeof parsed.session?.refreshToken !== 'string' ||
        typeof parsed.session?.expiresAt !== 'string' ||
        typeof parsed.session?.userId !== 'string'
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private async writeGrace(sessionId: SessionId, record: RefreshGraceRecord): Promise<void> {
    await this.redis.set(
      cacheKeys.refreshReuseGrace(sessionId),
      JSON.stringify(record),
      'EX',
      cacheTtl.refreshReuseGrace,
    );
  }
}

function hashesMatch(stored: string, provided: string): boolean {
  const storedBuffer = Buffer.from(stored, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  return (
    storedBuffer.length === providedBuffer.length && timingSafeEqual(storedBuffer, providedBuffer)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
