import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';

import type { Surface } from '../entities/Surface';
import type { SurfaceId } from '../value-objects/SurfaceId';

export interface SurfaceRepository {
  findBySpaceId(spaceId: SpaceId): Promise<Surface | null>;
  create(spaceId: SpaceId): Promise<Surface>;
  /** Bumped when the set of occupied cells changes, so clients can cheaply diff. */
  touch(id: SurfaceId): Promise<Surface>;
}

export const SURFACE_REPOSITORY = Symbol('SURFACE_REPOSITORY');
