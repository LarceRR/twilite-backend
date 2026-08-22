import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, lt, max, min, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { surfaceObjects, timelineEvents } from '@/database/schema';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { kindPolicy } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';
import { toUserId } from '@/modules/users/domain/value-objects/UserId';
import { InfrastructureError, ValidationError } from '@/shared/errors';

import type { SpaceStatistics } from '../../domain/entities/Statistics';
import type {
  TimelineEvent,
  TimelineEventId,
  TimelineEventType,
  TimelinePage,
} from '../../domain/entities/TimelineEvent';
import type {
  AppendTimelineEventInput,
  TimelineQuery,
  TimelineRepository,
} from '../../domain/repositories/TimelineRepository';

type EventRow = typeof timelineEvents.$inferSelect;

@Injectable()
export class DrizzleTimelineRepository implements TimelineRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async append(input: AppendTimelineEventInput): Promise<TimelineEvent> {
    const [row] = await this.db
      .insert(timelineEvents)
      .values({
        spaceId: input.spaceId,
        type: input.type,
        actorUserId: input.actorUserId,
        subjectUserId: input.subjectUserId,
        payload: input.payload,
      })
      .returning();

    if (row === undefined) {
      throw new InfrastructureError('Не удалось записать событие истории');
    }

    return toTimelineEvent(row);
  }

  /**
   * Keyset pagination on the monotonic sequence: stable under concurrent writes
   * and cheap regardless of how deep the client scrolls.
   */
  async query(query: TimelineQuery): Promise<TimelinePage> {
    const filters = [eq(timelineEvents.spaceId, query.spaceId)];

    if (query.cursor !== null) {
      filters.push(lt(timelineEvents.sequence, decodeCursor(query.cursor)));
    }

    if (query.types !== null && query.types.length > 0) {
      filters.push(inArray(timelineEvents.type, [...query.types]));
    }

    const rows = await this.db
      .select()
      .from(timelineEvents)
      .where(and(...filters))
      .orderBy(desc(timelineEvents.sequence))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      events: page.map(toTimelineEvent),
      nextCursor: hasMore && last !== undefined ? encodeCursor(last.sequence) : null,
    };
  }

  async statistics(spaceId: SpaceId): Promise<SpaceStatistics> {
    const [totals] = await this.db
      .select({
        total: count(),
        favorites: sql<number>`count(*) filter (where ${surfaceObjects.favorite})`,
        firstAt: min(surfaceObjects.createdAt),
        lastAt: max(surfaceObjects.createdAt),
      })
      .from(surfaceObjects)
      .where(eq(surfaceObjects.spaceId, spaceId));

    const byKindRows = await this.db
      .select({ kind: surfaceObjects.kind, total: count() })
      .from(surfaceObjects)
      .where(eq(surfaceObjects.spaceId, spaceId))
      .groupBy(surfaceObjects.kind);

    const byKind: Record<string, number> = {};
    let positive = 0;
    let negative = 0;

    for (const row of byKindRows) {
      byKind[row.kind] = row.total;
      const valence = kindPolicy(row.kind).valence;

      if (valence === 'positive') {
        positive += row.total;
      } else if (valence === 'negative') {
        negative += row.total;
      }
    }

    const valenced = positive + negative;

    return {
      totalObjects: totals?.total ?? 0,
      byKind,
      favorites: Number(totals?.favorites ?? 0),
      balance: valenced === 0 ? 0 : (positive - negative) / valenced,
      firstObjectAt: totals?.firstAt ?? null,
      lastObjectAt: totals?.lastAt ?? null,
    };
  }
}

function encodeCursor(sequence: number): string {
  return Buffer.from(String(sequence), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): number {
  const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));

  if (!Number.isSafeInteger(decoded) || decoded < 0) {
    throw new ValidationError('Некорректный курсор пагинации', [
      { path: 'cursor', message: 'Значение получено не из предыдущего ответа' },
    ]);
  }

  return decoded;
}

function toTimelineEvent(row: EventRow): TimelineEvent {
  return {
    id: row.id as TimelineEventId,
    spaceId: row.spaceId as SpaceId,
    type: row.type as TimelineEventType,
    actorUserId: row.actorUserId === null ? null : toUserId(row.actorUserId),
    subjectUserId: row.subjectUserId === null ? null : toUserId(row.subjectUserId),
    payload: (row.payload ?? {}) as Readonly<Record<string, unknown>>,
    createdAt: row.createdAt,
  };
}
