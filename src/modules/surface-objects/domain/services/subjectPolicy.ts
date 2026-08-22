import { counterpartId, type Space } from '@/modules/spaces/domain/entities/Space';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { DomainError } from '@/shared/errors';

import { kindPolicy, type SurfaceObjectKind } from '../value-objects/SurfaceObjectKind';

/**
 * The pair principle: in a Shared space the object is placed by the *other*
 * partner, reacting to what someone did. Marking your own action there would
 * turn the surface into a self-report, which is not what it is for.
 */
export function assertSubjectAllowed(params: {
  readonly space: Space;
  readonly kind: SurfaceObjectKind;
  readonly createdByUserId: UserId;
  readonly subjectUserId: UserId;
}): void {
  const { space, kind, createdByUserId, subjectUserId } = params;

  if (createdByUserId !== subjectUserId) {
    return;
  }

  if (space.type === 'Shared') {
    throw new DomainError('В общем пространстве объект ставит партнёр', {
      spaceId: space.id,
      createdByUserId,
      subjectUserId,
    });
  }

  if (!kindPolicy(kind).allowSelfSubject) {
    throw new DomainError('Этот тип объекта нельзя адресовать себе', { kind });
  }
}

/** Who the object is about when the client does not say. */
export function defaultSubjectUserId(space: Space, createdByUserId: UserId): UserId {
  return counterpartId(space, createdByUserId) ?? createdByUserId;
}
