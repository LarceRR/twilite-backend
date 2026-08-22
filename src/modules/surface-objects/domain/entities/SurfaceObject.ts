import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { SurfaceId } from '@/modules/surfaces/domain/value-objects/SurfaceId';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { ConflictError, DomainError } from '@/shared/errors';
import type { Brand } from '@/shared/types/Brand';

import type { Cell } from '../value-objects/Cell';
import { kindPolicy, type SurfaceObjectKind } from '../value-objects/SurfaceObjectKind';
import {
  nextState,
  type SurfaceObjectState,
  type SurfaceObjectTransition,
} from '../value-objects/SurfaceObjectState';

export type SurfaceObjectId = Brand<string, 'SurfaceObjectId'>;

export type SurfaceObjectMetadata = {
  readonly note?: string;
  readonly mediaIds?: readonly string[];
  readonly [key: string]: unknown;
};

/**
 * The single object that lives on a surface. Fire and Cloud are values of `kind`,
 * not separate entities — that is what keeps new kinds free to add.
 */
export type SurfaceObject = {
  readonly id: SurfaceObjectId;
  readonly spaceId: SpaceId;
  readonly surfaceId: SurfaceId;
  readonly cell: Cell;
  readonly kind: SurfaceObjectKind;
  readonly state: SurfaceObjectState;
  readonly createdByUserId: UserId;
  readonly subjectUserId: UserId;
  readonly metadata: SurfaceObjectMetadata;
  readonly favorite: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
};

export function applyTransition(
  object: SurfaceObject,
  transition: SurfaceObjectTransition,
  now: Date,
): SurfaceObject {
  const policy = kindPolicy(object.kind);

  if (policy.blockedTransitions.includes(transition)) {
    throw new DomainError('Этот тип объекта не поддерживает такой переход', {
      kind: object.kind,
      transition,
    });
  }

  return {
    ...object,
    state: nextState(object.state, transition),
    updatedAt: now,
    version: object.version + 1,
  };
}

export function withMetadata(
  object: SurfaceObject,
  metadata: SurfaceObjectMetadata,
  now: Date,
): SurfaceObject {
  return { ...object, metadata, updatedAt: now, version: object.version + 1 };
}

export function withFavorite(object: SurfaceObject, favorite: boolean, now: Date): SurfaceObject {
  return { ...object, favorite, updatedAt: now, version: object.version + 1 };
}

/**
 * Optimistic locking. The client always sends the version it saw; a mismatch
 * means someone else changed the object and the client must refetch.
 */
export function assertVersion(object: SurfaceObject, expected: number): void {
  if (object.version !== expected) {
    throw new ConflictError('Объект был изменён', {
      objectId: object.id,
      expected,
      actual: object.version,
    });
  }
}
