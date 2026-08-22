import { Inject, Injectable } from '@nestjs/common';

import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { StatisticsDto, TimelinePageDto } from '@/shared/contracts/timeline.contract';

import { type TimelineEventType, timelineEventTypes } from '../../domain/entities/TimelineEvent';
import {
  TIMELINE_REPOSITORY,
  type TimelineRepository,
} from '../../domain/repositories/TimelineRepository';

@Injectable()
export class GetTimelineHandler {
  constructor(
    @Inject(TIMELINE_REPOSITORY) private readonly timeline: TimelineRepository,
    private readonly access: SpaceAccessService,
  ) {}

  async execute(params: {
    readonly spaceId: SpaceId;
    readonly userId: UserId;
    readonly limit: number;
    readonly cursor: string | null;
    readonly types: string | null;
  }): Promise<TimelinePageDto> {
    await this.access.assertPermission(params.spaceId, params.userId, 'space.view');

    const page = await this.timeline.query({
      spaceId: params.spaceId,
      limit: params.limit,
      cursor: params.cursor,
      types: parseTypes(params.types),
    });

    return {
      events: page.events.map((event) => ({
        id: event.id,
        spaceId: event.spaceId,
        type: event.type,
        actorUserId: event.actorUserId,
        subjectUserId: event.subjectUserId,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async statistics(spaceId: SpaceId, userId: UserId): Promise<StatisticsDto> {
    await this.access.assertPermission(spaceId, userId, 'space.view');

    const stats = await this.timeline.statistics(spaceId);

    return {
      totalObjects: stats.totalObjects,
      byKind: stats.byKind,
      favorites: stats.favorites,
      balance: stats.balance,
      firstObjectAt: stats.firstObjectAt?.toISOString() ?? null,
      lastObjectAt: stats.lastObjectAt?.toISOString() ?? null,
    };
  }
}

/** Unknown type names are ignored rather than rejected, so old clients keep working. */
function parseTypes(raw: string | null): readonly TimelineEventType[] | null {
  if (raw === null || raw.length === 0) {
    return null;
  }

  const known = new Set<string>(timelineEventTypes);
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is TimelineEventType => known.has(value));

  return parsed.length === 0 ? null : parsed;
}
