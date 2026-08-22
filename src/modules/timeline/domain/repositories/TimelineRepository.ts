import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type { SpaceStatistics } from '../entities/Statistics';
import type { TimelineEvent, TimelineEventType, TimelinePage } from '../entities/TimelineEvent';

export type AppendTimelineEventInput = {
  readonly spaceId: SpaceId;
  readonly type: TimelineEventType;
  readonly actorUserId: UserId | null;
  readonly subjectUserId: UserId | null;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type TimelineQuery = {
  readonly spaceId: SpaceId;
  readonly limit: number;
  readonly cursor: string | null;
  readonly types: readonly TimelineEventType[] | null;
};

export interface TimelineRepository {
  append(input: AppendTimelineEventInput): Promise<TimelineEvent>;
  query(query: TimelineQuery): Promise<TimelinePage>;
  statistics(spaceId: SpaceId): Promise<SpaceStatistics>;
}

export const TIMELINE_REPOSITORY = Symbol('TIMELINE_REPOSITORY');
