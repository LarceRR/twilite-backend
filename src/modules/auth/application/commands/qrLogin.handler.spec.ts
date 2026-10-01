import { describe, expect, it, vi } from 'vitest';

import type { AppLimits } from '@/config/limits';
import { toUserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthenticationError, DomainError, ValidationError } from '@/shared/errors';
import type { Clock } from '@/shared/utils/clock';
import type { IdGenerator } from '@/shared/utils/id';

import type { AuthRateLimiter } from '../services/authRateLimiter';
import { MemoryQrChallengeRepository } from '../../infrastructure/repositories/memoryQrChallengeRepository';
import { parseQrLoginPayload } from '../../domain/services/qrLoginTokens';
import type { AuthenticateHandler } from './authenticate.handler';
import { QrLoginHandler } from './qrLogin.handler';

const limits = {
  auth: {
    qrLoginTtlSeconds: 30,
    qrChallengesPerIpPerHour: 5,
    qrApprovalsPerUserPerHour: 5,
    qrPollsPerChallengePerMinute: 30,
  },
} as AppLimits;

const userA = toUserId('11111111-1111-4111-8111-111111111111');
const userB = toUserId('22222222-2222-4222-8222-222222222222');

class MemoryRateLimiter implements AuthRateLimiter {
  readonly counts = new Map<string, number>();

  async consume(key: string, limit: number): Promise<boolean> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next <= limit;
  }
}

function createHandler(options?: { clock?: Clock; ids?: IdGenerator; limiter?: MemoryRateLimiter }) {
  const now = { value: new Date('2026-09-27T12:00:00.000Z') };
  const clock: Clock = options?.clock ?? { now: () => now.value };
  let sequence = 0;
  const ids: IdGenerator =
    options?.ids ??
    {
      next: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    };
  const limiter = options?.limiter ?? new MemoryRateLimiter();
  const issueSession = vi.fn().mockResolvedValue({
    accessToken: 'access.jwt',
    refreshToken: 'refresh.token',
    expiresAt: '2026-09-27T12:15:00.000Z',
    userId: userA,
  });
  const handler = new QrLoginHandler(
    new MemoryQrChallengeRepository(),
    limiter,
    limits,
    clock,
    ids,
    { issueSession } as unknown as AuthenticateHandler,
  );

  return { handler, issueSession, now, limiter };
}

describe('QrLoginHandler', () => {
  it('создаёт вызов: QR содержит login-токен, poll-секрет в QR не попадает', async () => {
    const { handler } = createHandler();
    const started = await handler.start({
      device: { platform: 'web', model: 'Chrome', appVersion: 'tpg-web' },
      ip: '203.0.113.10',
    });

    expect(started.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(started.qrPayload.startsWith('twilite.login.v1.')).toBe(true);
    expect(started.qrPayload.includes('://')).toBe(false);
    expect(started.qrPayload).not.toContain(started.pollToken);
    expect(started.qrPayload).not.toContain(started.challengeId);
    expect(parseQrLoginPayload(started.qrPayload)).not.toBeNull();
    expect(started.expiresInSeconds).toBe(30);
  });

  it('полный цикл как в Telegram: scan → confirm → браузер получает сессию один раз', async () => {
    const { handler, issueSession } = createHandler();
    const started = await handler.start({
      device: { platform: 'web', model: 'Chrome', appVersion: 'tpg-web' },
      ip: '203.0.113.10',
    });

    expect(await handler.poll({ challengeId: started.challengeId, pollToken: started.pollToken })).toEqual({
      status: 'pending',
    });

    const preview = await handler.inspect({ userId: userA, token: started.qrPayload });
    expect(preview.requestingDevice.ipLabel).toBe('203.0.113.x');
    expect(preview.requestingDevice.model).toBe('Chrome');
    expect(preview).not.toHaveProperty('email');
    expect(preview).not.toHaveProperty('userId');

    expect(await handler.poll({ challengeId: started.challengeId, pollToken: started.pollToken })).toEqual({
      status: 'scanned',
    });

    await expect(handler.approve({ userId: userA, token: started.qrPayload })).resolves.toEqual({
      status: 'approved',
    });

    const approved = await handler.poll({
      challengeId: started.challengeId,
      pollToken: started.pollToken,
    });

    expect(approved).toEqual({
      status: 'approved',
      session: {
        accessToken: 'access.jwt',
        refreshToken: 'refresh.token',
        expiresAt: '2026-09-27T12:15:00.000Z',
        userId: userA,
      },
    });
    expect(issueSession).toHaveBeenCalledOnce();

    const replay = await handler.poll({
      challengeId: started.challengeId,
      pollToken: started.pollToken,
    });
    expect(replay).toEqual({ status: 'expired' });
    expect(issueSession).toHaveBeenCalledOnce();
  });

  it('не отдаёт сессию тому, кто знает QR, но не владеет poll-секретом', async () => {
    const { handler, issueSession } = createHandler();
    const started = await handler.start({ device: null, ip: '203.0.113.10' });
    await handler.approve({ userId: userA, token: started.qrPayload });

    const hijack = await handler.poll({
      challengeId: started.challengeId,
      pollToken: started.pollToken.slice(0, -2) + 'aa',
    });

    expect(hijack).toEqual({ status: 'expired' });
    expect(issueSession).toHaveBeenCalledOnce();

    const owner = await handler.poll({
      challengeId: started.challengeId,
      pollToken: started.pollToken,
    });
    expect(owner.status).toBe('approved');
    expect(issueSession).toHaveBeenCalledOnce();
  });

  it('не даёт второму аккаунту перехватить уже просканированный вызов', async () => {
    const { handler } = createHandler();
    const started = await handler.start({ device: null, ip: '10.0.0.1' });
    await handler.inspect({ userId: userA, token: started.qrPayload });

    await expect(handler.inspect({ userId: userB, token: started.qrPayload })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(handler.approve({ userId: userB, token: started.qrPayload })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('отклоняет повторное подтверждение и просроченный токен', async () => {
    const { handler, now } = createHandler();
    const started = await handler.start({ device: null, ip: '10.0.0.1' });
    await handler.approve({ userId: userA, token: started.qrPayload });

    await expect(handler.approve({ userId: userA, token: started.qrPayload })).rejects.toBeInstanceOf(
      DomainError,
    );

    now.value = new Date('2026-09-27T12:00:31.000Z');
    const expired = await handler.start({ device: null, ip: '10.0.0.2' });
    now.value = new Date('2026-09-27T12:01:10.000Z');

    await expect(handler.inspect({ userId: userA, token: expired.qrPayload })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(await handler.poll({ challengeId: expired.challengeId, pollToken: expired.pollToken })).toEqual({
      status: 'expired',
    });
  });

  it('отклоняет вход и гасит вызов без выдачи сессии', async () => {
    const { handler, issueSession } = createHandler();
    const started = await handler.start({ device: null, ip: '10.0.0.1' });
    await handler.inspect({ userId: userA, token: started.qrPayload });
    await expect(handler.deny({ userId: userA, token: started.qrPayload })).resolves.toEqual({
      status: 'denied',
    });

    expect(await handler.poll({ challengeId: started.challengeId, pollToken: started.pollToken })).toEqual({
      status: 'denied',
    });
    expect(issueSession).not.toHaveBeenCalled();
  });

  it('не принимает клиентский или чужой токен', async () => {
    const { handler } = createHandler();

    await expect(handler.inspect({ userId: userA, token: 'not-a-token' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await expect(
      handler.inspect({ userId: userA, token: 'twilite://login?v=1&token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('режет флуд создания QR с одного адреса', async () => {
    const limiter = new MemoryRateLimiter();
    const { handler } = createHandler({ limiter });

    for (let index = 0; index < 5; index += 1) {
      await handler.start({ device: null, ip: '198.51.100.9' });
    }

    await expect(handler.start({ device: null, ip: '198.51.100.9' })).rejects.toBeInstanceOf(ValidationError);
  });
});
