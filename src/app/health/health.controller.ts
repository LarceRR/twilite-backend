import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';
import { Public } from '@/shared/decorators/auth.decorators';

import { type DependencyStatus, probeDependencies } from './dependencyChecks';

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
    const checks = await probeDependencies(this.db, this.redis);

    return {
      status: checks.database === 'up' && checks.cache === 'up' ? 'ok' : 'degraded',
      checks,
    };
  }
}
