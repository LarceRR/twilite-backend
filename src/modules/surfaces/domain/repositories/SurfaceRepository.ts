import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';

import type { Surface } from '../entities/Surface';

export interface SurfaceRepository {
  findBySpaceId(spaceId: SpaceId): Promise<Surface | null>;
  create(spaceId: SpaceId): Promise<Surface>;
}

export const SURFACE_REPOSITORY = Symbol('SURFACE_REPOSITORY');
