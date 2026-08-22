import { Inject, Injectable } from '@nestjs/common';
import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { NotFoundError } from '@/shared/errors';

import type { Space } from '../../domain/entities/Space';
import { SPACE_REPOSITORY, type SpaceRepository } from '../../domain/repositories/SpaceRepository';
import { assertPermission } from '../../domain/services/permissionService';
import type { SpaceId, SpacePermission } from '../../domain/value-objects/SpacePermission';

/**
 * Steps 2 and 3 of the shared-space flow (resolve the space, check the permission)
 * in one place, so every use case and guard enforces them identically.
 */
@Injectable()
export class SpaceAccessService {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepository,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  async requireSpace(spaceId: SpaceId): Promise<Space> {
    const cached = await this.cache.get<Space>(cacheKeys.space(spaceId));

    if (cached !== null) {
      return reviveDates(cached);
    }

    const space = await this.spaces.findById(spaceId);

    if (space === null) {
      throw new NotFoundError('Пространство не найдено', { spaceId });
    }

    await this.cache.set(cacheKeys.space(spaceId), space, cacheTtl.space);

    return space;
  }

  async assertPermission(
    spaceId: SpaceId,
    userId: UserId,
    permission: SpacePermission,
  ): Promise<Space> {
    const space = await this.requireSpace(spaceId);
    assertPermission(space, userId, permission);

    return space;
  }

  async invalidate(spaceId: SpaceId, memberIds: readonly UserId[] = []): Promise<void> {
    await this.cache.invalidate(
      cacheKeys.space(spaceId),
      cacheKeys.surfaceSnapshot(spaceId),
      cacheKeys.statistics(spaceId),
      ...memberIds.map((id) => cacheKeys.spaceList(id)),
    );
  }
}

/** JSON round-trips turn Dates into strings; the domain expects Dates. */
function reviveDates(space: Space): Space {
  return {
    ...space,
    createdAt: new Date(space.createdAt),
    members: space.members.map((member) => ({ ...member, joinedAt: new Date(member.joinedAt) })),
  };
}
