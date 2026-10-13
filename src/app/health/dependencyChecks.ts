import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';

import type { Database } from '@/database/drizzle/drizzle.module';
import { InfrastructureError } from '@/shared/errors';

export type DependencyStatus = 'up' | 'down';

export type DependencyChecks = {
  readonly database: DependencyStatus;
  readonly cache: DependencyStatus;
};

const STARTUP_CHECK_TIMEOUT_MS = 5_000;

/** Probe Postgres with a trivial query. */
export async function checkDatabase(db: Database): Promise<DependencyStatus> {
  try {
    await withTimeout(db.execute(sql`select 1`), STARTUP_CHECK_TIMEOUT_MS, 'database');
    return 'up';
  } catch {
    return 'down';
  }
}

/** Probe Redis with PING. */
export async function checkRedis(redis: Redis): Promise<DependencyStatus> {
  try {
    await withTimeout(redis.ping(), STARTUP_CHECK_TIMEOUT_MS, 'redis');
    return 'up';
  } catch {
    return 'down';
  }
}

/** Run both probes in parallel. */
export async function probeDependencies(db: Database, redis: Redis): Promise<DependencyChecks> {
  const [database, cache] = await Promise.all([checkDatabase(db), checkRedis(redis)]);
  return { database, cache };
}

/**
 * Fail-fast gate for process boot: both Postgres and Redis must answer.
 * Nest builds the graph without waiting on either, so this is the only place
 * that refuses to listen when the critical stores are gone.
 */
export async function assertCriticalDependencies(db: Database, redis: Redis): Promise<void> {
  const checks = await probeDependencies(db, redis);
  const down = (['database', 'cache'] as const).filter((name) => checks[name] === 'down');
  if (down.length === 0) {
    return;
  }

  throw new InfrastructureError(`Критические зависимости недоступны: ${down.join(', ')}`, {
    checks,
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} check timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
