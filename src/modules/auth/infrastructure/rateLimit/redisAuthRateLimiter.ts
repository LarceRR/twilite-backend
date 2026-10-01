import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

import type { AuthRateLimiter } from '../../application/services/authRateLimiter';

@Injectable()
export class RedisAuthRateLimiter implements AuthRateLimiter {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!this.config.app.isProduction) {
      return true;
    }

    const redisKey = `auth:rate:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }

    return count <= limit;
  }
}
