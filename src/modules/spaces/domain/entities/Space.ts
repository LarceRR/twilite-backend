import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type {
  SpaceId,
  SpacePermission,
  SpaceRole,
  SpaceType,
} from '../value-objects/SpacePermission';

export type SpaceMember = {
  readonly userId: UserId;
  readonly role: SpaceRole;
  readonly permissions: readonly SpacePermission[];
  readonly joinedAt: Date;
};

export type Space = {
  readonly id: SpaceId;
  readonly type: SpaceType;
  readonly title: string;
  readonly ownerId: UserId;
  readonly members: readonly SpaceMember[];
  readonly createdAt: Date;
  readonly version: number;
};

export function findMember(space: Space, userId: UserId): SpaceMember | null {
  return space.members.find((member) => member.userId === userId) ?? null;
}

/** In a Shared space with two people, the "other" member. */
export function counterpartId(space: Space, userId: UserId): UserId | null {
  if (space.type !== 'Shared') {
    return null;
  }

  return space.members.find((member) => member.userId !== userId)?.userId ?? null;
}
