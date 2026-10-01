import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSessionDto } from '@/shared/contracts/auth.contract';
import { AuthenticationError } from '@/shared/errors';
import { toUserId } from '@/modules/users/domain/value-objects/UserId';

import type { Session, SessionId, SessionRepository } from '../../domain/repositories/SessionRepository';
import type { TokenService } from '../services/token.service';
import { RefreshSessionHandler } from './refreshSession.handler';

const SESSION_ID = '11111111-1111-4111-8111-111111111111' as SessionId;
const USER_ID = toUserId('22222222-2222-4222-8222-222222222222');

describe('RefreshSessionHandler', () => {
  const sessions = {
    findById: vi.fn(),
    rotateIfHashMatches: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const tokens = {
    parseRefreshToken: vi.fn(),
    hashRefreshToken: vi.fn((token: string) => `hash:${token}`),
    createRefreshToken: vi.fn(() => `${SESSION_ID}.next-refresh`),
    refreshExpiry: vi.fn(() => new Date('2026-10-29T00:00:00.000Z')),
    issueAccessToken: vi.fn(async () => ({
      token: 'access.next',
      expiresAt: new Date('2026-09-29T12:15:00.000Z'),
    })),
  };
  const clock = { now: () => new Date('2026-09-29T12:00:00.000Z') };

  let handler: RefreshSessionHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    sessions.revokeAllForUser.mockResolvedValue(undefined);
    tokens.parseRefreshToken.mockReturnValue({
      sessionId: SESSION_ID,
      hash: 'hash:current',
    });
    handler = new RefreshSessionHandler(
      sessions as unknown as SessionRepository,
      clock,
      redis as never,
      tokens as unknown as TokenService,
    );
  });

  it('ротирует текущий refresh и кладёт пару в grace-cache', async () => {
    sessions.findById.mockResolvedValue(activeSession({ refreshTokenHash: 'hash:current' }));
    sessions.rotateIfHashMatches.mockResolvedValue(activeSession({ refreshTokenHash: 'hash:next' }));

    const result = await handler.execute(`${SESSION_ID}.current`);

    expect(result).toEqual<AuthSessionDto>({
      accessToken: 'access.next',
      refreshToken: `${SESSION_ID}.next-refresh`,
      expiresAt: '2026-09-29T12:15:00.000Z',
      userId: USER_ID,
    });
    expect(redis.set).toHaveBeenCalledOnce();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('при параллельном CAS отдаёт ту же пару из grace вместо revoke-all', async () => {
    const issued: AuthSessionDto = {
      accessToken: 'access.winner',
      refreshToken: `${SESSION_ID}.winner`,
      expiresAt: '2026-09-29T12:15:00.000Z',
      userId: USER_ID,
    };

    sessions.findById.mockResolvedValue(activeSession({ refreshTokenHash: 'hash:current' }));
    sessions.rotateIfHashMatches.mockResolvedValue(null);
    redis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        JSON.stringify({ previousHash: 'hash:current', session: issued }),
      );

    const result = await handler.execute(`${SESSION_ID}.current`);

    expect(result).toEqual(issued);
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('повтор предыдущего токена в grace-окне не убивает сессии', async () => {
    const issued: AuthSessionDto = {
      accessToken: 'access.winner',
      refreshToken: `${SESSION_ID}.winner`,
      expiresAt: '2026-09-29T12:15:00.000Z',
      userId: USER_ID,
    };

    tokens.parseRefreshToken.mockReturnValue({
      sessionId: SESSION_ID,
      hash: 'hash:previous',
    });
    sessions.findById.mockResolvedValue(activeSession({ refreshTokenHash: 'hash:current' }));
    redis.get.mockResolvedValue(
      JSON.stringify({ previousHash: 'hash:previous', session: issued }),
    );

    const result = await handler.execute(`${SESSION_ID}.previous`);

    expect(result).toEqual(issued);
    expect(sessions.rotateIfHashMatches).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('повтор вне grace-окна отзывает все сессии пользователя', async () => {
    tokens.parseRefreshToken.mockReturnValue({
      sessionId: SESSION_ID,
      hash: 'hash:stolen',
    });
    sessions.findById.mockResolvedValue(activeSession({ refreshTokenHash: 'hash:current' }));
    redis.get.mockResolvedValue(null);

    await expect(handler.execute(`${SESSION_ID}.stolen`)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
  });
});

function activeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    refreshTokenHash: 'hash:current',
    device: { platform: 'web', model: null, appVersion: 'tpg-web' },
    ipLabel: '127.0.0.x',
    createdAt: new Date('2026-09-29T11:00:00.000Z'),
    lastUsedAt: new Date('2026-09-29T11:00:00.000Z'),
    expiresAt: new Date('2026-10-29T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
}
