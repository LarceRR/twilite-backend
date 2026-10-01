import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

import type { QrLoginChallenge, QrLoginChallengePatch } from '../../domain/qrLogin/qrLoginChallenge';
import type { QrLoginStatus } from '../../domain/qrLogin/qrLoginChallenge';
import type { QrLoginChallengeRepository } from '../../domain/repositories/QrLoginChallengeRepository';

const CHALLENGE_PREFIX = 'auth:qr:challenge:';
const LOGIN_PREFIX = 'auth:qr:login:';

@Injectable()
export class RedisQrChallengeRepository implements QrLoginChallengeRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(challenge: QrLoginChallenge, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(1, ttlSeconds);
    const payload = JSON.stringify(challenge);

    await this.redis
      .multi()
      .set(challengeKey(challenge.id), payload, 'EX', ttl)
      .set(loginKey(challenge.loginTokenHash), challenge.id, 'EX', ttl)
      .exec();
  }

  async findById(id: string): Promise<QrLoginChallenge | null> {
    return this.read(challengeKey(id));
  }

  async findByLoginTokenHash(loginTokenHash: string): Promise<QrLoginChallenge | null> {
    const id = await this.redis.get(loginKey(loginTokenHash));

    if (id === null) {
      return null;
    }

    return this.findById(id);
  }

  async transition(
    id: string,
    allowed: readonly QrLoginStatus[],
    patch: QrLoginChallengePatch,
  ): Promise<QrLoginChallenge | null> {
    const key = challengeKey(id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.redis.watch(key);
      const current = await this.read(key);

      if (current === null || !allowed.includes(current.status)) {
        await this.redis.unwatch();
        return null;
      }

      const next: QrLoginChallenge = { ...current, ...patch };
      const ttl = await this.redis.ttl(key);
      const multi = this.redis.multi();
      multi.set(key, JSON.stringify(next), 'EX', Math.max(ttl, 1));
      const result = await multi.exec();

      if (result !== null) {
        return next;
      }
    }

    return null;
  }

  private async read(key: string): Promise<QrLoginChallenge | null> {
    const raw = await this.redis.get(key);

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as QrLoginChallenge;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }
}

function challengeKey(id: string): string {
  return `${CHALLENGE_PREFIX}${id}`;
}

function loginKey(hash: string): string {
  return `${LOGIN_PREFIX}${hash}`;
}
