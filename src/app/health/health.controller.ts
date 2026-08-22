import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';
import { Public } from '@/shared/decorators/auth.decorators';

type DependencyStatus = 'up' | 'down';

type HealthReport = {
  readonly status: 'ok' | 'degraded';
  readonly checks: Readonly<Record<string, DependencyStatus>>;
};

/**
 * Used by the container orchestrator, so it reports real dependency reachability
 * rather than "the process is alive".
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Состояние сервиса и его зависимостей' })
  async health(): Promise<HealthReport> {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      status: database === 'up' && cache === 'up' ? 'ok' : 'degraded',
      checks: { database, cache },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.db.execute(sql`select 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      await this.redis.ping();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
