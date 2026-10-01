import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { ACCESS_COOKIE, readAccessToken } from '@/modules/auth/application/services/sessionCookies';
import type { SessionRepository } from '@/modules/auth/domain/repositories/SessionRepository';
import type { TokenService } from '@/modules/auth/application/services/token.service';
import { AuthenticationError } from '@/shared/errors';
import type { Clock } from '@/shared/utils/clock';

import { JwtAuthGuard } from './jwtAuth.guard';

describe('readAccessToken', () => {
  it('предпочитает Bearer и иначе берёт httpOnly cookie', () => {
    expect(
      readAccessToken({
        headers: { authorization: 'Bearer header-token', cookie: `${ACCESS_COOKIE}=cookie-token` },
      } as FastifyRequest),
    ).toBe('header-token');

    expect(
      readAccessToken({
        headers: { cookie: `${ACCESS_COOKIE}=cookie-token` },
      } as FastifyRequest),
    ).toBe('cookie-token');

    expect(readAccessToken({ headers: {} } as FastifyRequest)).toBeNull();
  });
});

describe('JwtAuthGuard', () => {
  const verifyAccessToken = vi.fn();
  const findById = vi.fn();
  const getAllAndOverride = vi.fn();
  const now = vi.fn(() => new Date('2026-01-15T12:00:00.000Z'));

  const tokens = { verifyAccessToken } as unknown as TokenService;
  const sessions = { findById } as unknown as SessionRepository;
  const clock = { now } as Clock;
  const reflector = { getAllAndOverride } as unknown as Reflector;

  const guard = new JwtAuthGuard(reflector, tokens, sessions, clock);

  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: { authorization: 'Bearer access-token' },
  };

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    verifyAccessToken.mockReset();
    findById.mockReset();
    getAllAndOverride.mockReset();
    request.user = undefined;
    getAllAndOverride.mockReturnValue(false);
  });

  it('пропускает публичные маршруты без токена', async () => {
    getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('отклоняет отозванную сессию даже при валидном JWT', async () => {
    verifyAccessToken.mockResolvedValue({ userId: 'user-1', sessionId: 'session-1' });
    findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: new Date('2026-01-15T11:00:00.000Z'),
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('принимает активную сессию и кладёт user в request', async () => {
    verifyAccessToken.mockResolvedValue({ userId: 'user-1', sessionId: 'session-1' });
    findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', sessionId: 'session-1' });
  });
});
