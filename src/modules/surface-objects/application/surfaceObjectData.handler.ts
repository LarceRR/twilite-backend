import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { cacheKeys } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import { findMember } from '@/modules/spaces/domain/entities/Space';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthorizationError } from '@/shared/errors';
import { domainEventNames } from '@/shared/events/domainEvents';

import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '../domain/repositories/SurfaceObjectRepository';
import { kindPolicy } from '../domain/value-objects/SurfaceObjectKind';

export type SurfaceMomentStats = {
  readonly total: number;
  readonly good: number;
  readonly bad: number;
};

@Injectable()
export class SurfaceObjectDataHandler {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    private readonly access: SpaceAccessService,
    @Inject(CACHE) private readonly cache: Cache,
    private readonly events: EventEmitter2,
  ) {}

  async getMomentStats(spaceId: SpaceId, userId: UserId): Promise<SurfaceMomentStats> {
    const space = await this.access.requireSpace(spaceId);
    if (findMember(space, userId) === null) {
      throw new AuthorizationError('Недостаточно прав в этом пространстве', { spaceId, userId });
    }
    const counts = await this.objects.countBySpace(space.id);

    return counts.reduce<SurfaceMomentStats>(
      (stats, entry) => {
        const valence = kindPolicy(entry.kind).valence;
        return {
          total: stats.total + entry.count,
          good: stats.good + (valence === 'positive' ? entry.count : 0),
          bad: stats.bad + (valence === 'negative' ? entry.count : 0),
        };
      },
      { total: 0, good: 0, bad: 0 },
    );
  }

  async clearPersonalSpace(spaceId: SpaceId, userId: UserId): Promise<void> {
    const space = await this.access.assertPermission(spaceId, userId, 'surfaceObject.delete');
    if (space.type !== 'Personal' || space.ownerId !== userId) {
      throw new AuthorizationError('Можно очистить только своё личное пространство', {
        spaceId,
        userId,
      });
    }

    await this.objects.clearSpaceData(space.id, space.ownerId);
    await Promise.all([
      this.access.invalidate(space.id),
      this.cache.invalidatePrefix(cacheKeys.timelinePrefix(space.id)),
    ]);
    this.events.emit(domainEventNames.surfaceCleared, { spaceId: space.id });
  }
}
