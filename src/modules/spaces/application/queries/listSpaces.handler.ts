import { Inject, Injectable } from '@nestjs/common';

import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type { Invitation } from '../../domain/entities/Invitation';
import type { Space } from '../../domain/entities/Space';
import { SPACE_REPOSITORY, type SpaceRepository } from '../../domain/repositories/SpaceRepository';

@Injectable()
export class ListSpacesHandler {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepository,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  async execute(userId: UserId): Promise<readonly Space[]> {
    const cached = await this.cache.get<readonly Space[]>(cacheKeys.spaceList(userId));

    if (cached !== null) {
      return cached.map(reviveSpaceDates);
    }

    const spaces = [...(await this.spaces.listForUser(userId))];
    await this.cache.set(cacheKeys.spaceList(userId), spaces, cacheTtl.spaceList);
    return spaces;
  }

  async listInvitations(userId: UserId, email: string): Promise<readonly Invitation[]> {
    return this.spaces.listInvitationsForUser(userId, email);
  }
}

/** Redis JSON turns Date values into strings; restore the domain invariant. */
function reviveSpaceDates(space: Space): Space {
  return {
    ...space,
    createdAt: new Date(space.createdAt),
    members: space.members.map((member) => ({
      ...member,
      joinedAt: new Date(member.joinedAt),
    })),
  };
}
