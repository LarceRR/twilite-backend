import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { Brand } from '@/shared/types/Brand';

export type TimelineEventId = Brand<string, 'TimelineEventId'>;

export const timelineEventTypes = [
  'SurfaceObjectCreated',
  'SurfaceObjectStateChanged',
  'SurfaceObjectDeleted',
  'SurfaceObjectFavorited',
  'MemberJoined',
  'MemberLeft',
  'SpaceCreated',
] as const;

export type TimelineEventType = (typeof timelineEventTypes)[number];

/**
 * The timeline is an append-only projection: it is written from domain events and
 * never edited, so history cannot be rewritten by a later change.
 */
export type TimelineEvent = {
  readonly id: TimelineEventId;
  readonly spaceId: SpaceId;
  readonly type: TimelineEventType;
  readonly actorUserId: UserId | null;
  readonly subjectUserId: UserId | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
};

export type TimelinePage = {
  readonly events: readonly TimelineEvent[];
  /** Opaque to clients: the encoded position of the last returned row. */
  readonly nextCursor: string | null;
};
