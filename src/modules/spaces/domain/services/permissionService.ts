import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthorizationError } from '@/shared/errors';

import { findMember, type Space } from '../entities/Space';
import type { SpacePermission } from '../value-objects/SpacePermission';

export function hasPermission(space: Space, userId: UserId, permission: SpacePermission): boolean {
  const member = findMember(space, userId);

  if (member === null) {
    return false;
  }

  // A Personal space is owner-only by construction; no need to consult the list.
  if (space.type === 'Personal') {
    return member.userId === space.ownerId;
  }

  return member.permissions.includes(permission);
}

/**
 * Every use case that mutates a space, its surface or its objects calls this
 * before touching an aggregate. Missing permission is a 403, never a silent no-op.
 */
export function assertPermission(space: Space, userId: UserId, permission: SpacePermission): void {
  if (!hasPermission(space, userId, permission)) {
    throw new AuthorizationError('Недостаточно прав в этом пространстве', {
      spaceId: space.id,
      userId,
      permission,
    });
  }
}
