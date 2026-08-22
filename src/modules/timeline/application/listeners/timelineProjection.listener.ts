import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { cacheKeys } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import {
  domainEventNames,
  type SpaceMemberJoinedEvent,
  type SurfaceObjectCreatedEvent,
  type SurfaceObjectDeletedEvent,
  type SurfaceObjectStateChangedEvent,
  type TimelineAppendedEvent,
} from '@/shared/events/domainEvents';

import type { TimelineEventType } from '../../domain/entities/TimelineEvent';
import {
  TIMELINE_REPOSITORY,
  type TimelineRepository,
} from '../../domain/repositories/TimelineRepository';

/**
 * The timeline is built by listening to what happened elsewhere. The
 * surface-objects module has no idea a history exists, which is exactly why new
 * projections can be added without touching it.
 */
@Injectable()
export class TimelineProjectionListener {
  constructor(
    @Inject(TIMELINE_REPOSITORY) private readonly timeline: TimelineRepository,
    @Inject(CACHE) private readonly cache: Cache,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(domainEventNames.surfaceObjectCreated)
  async onCreated(event: SurfaceObjectCreatedEvent): Promise<void> {
    await this.append('SurfaceObjectCreated', event.spaceId as SpaceId, event.actorUserId, {
      objectId: event.object.id,
      kind: event.object.kind,
      cellX: event.object.cellX,
      cellY: event.object.cellY,
      subjectUserId: event.object.subjectUserId,
    });
  }

  @OnEvent(domainEventNames.surfaceObjectStateChanged)
  async onStateChanged(event: SurfaceObjectStateChangedEvent): Promise<void> {
    await this.append('SurfaceObjectStateChanged', event.spaceId as SpaceId, event.actorUserId, {
      objectId: event.object.id,
      kind: event.object.kind,
      transition: event.transition,
      state: event.object.state,
    });
  }

  @OnEvent(domainEventNames.surfaceObjectDeleted)
  async onDeleted(event: SurfaceObjectDeletedEvent): Promise<void> {
    await this.append('SurfaceObjectDeleted', event.spaceId as SpaceId, event.actorUserId, {
      objectId: event.objectId,
      kind: event.kind,
    });
  }

  @OnEvent(domainEventNames.spaceMemberJoined)
  async onMemberJoined(event: SpaceMemberJoinedEvent): Promise<void> {
    await this.append('MemberJoined', event.spaceId as SpaceId, event.userId, {
      userId: event.userId,
    });
  }

  private async append(
    type: TimelineEventType,
    spaceId: SpaceId,
    actorUserId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subjectUserId = payload['subjectUserId'];

    const event = await this.timeline.append({
      spaceId,
      type,
      actorUserId: (actorUserId as UserId | null) ?? null,
      subjectUserId: typeof subjectUserId === 'string' ? (subjectUserId as UserId) : null,
      payload,
    });

    await this.cache.invalidatePrefix(cacheKeys.timelinePrefix(spaceId));

    // Realtime and notifications listen for this rather than for the raw events,
    // so they always deliver a row that is already persisted.
    this.events.emit(domainEventNames.timelineAppended, {
      spaceId,
      event: {
        id: event.id,
        spaceId: event.spaceId,
        type: event.type,
        actorUserId: event.actorUserId,
        subjectUserId: event.subjectUserId,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      },
    } satisfies TimelineAppendedEvent);
  }
}
