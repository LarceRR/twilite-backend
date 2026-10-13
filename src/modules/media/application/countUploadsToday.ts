import { and, eq, gte, sql } from 'drizzle-orm';

import type { Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';

export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Count media tickets created by user since UTC midnight (for daily quota). */
export async function countUploadsToday(db: Database, ownerId: string): Promise<number> {
  const since = utcDayStart();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), gte(mediaAssets.createdAt, since)));

  return row?.count ?? 0;
}
