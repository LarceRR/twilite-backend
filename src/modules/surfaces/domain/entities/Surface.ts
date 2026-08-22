import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { SurfaceId } from '../value-objects/SurfaceId';

/**
 * Exactly one surface per space, created together with it. The surface holds no
 * cells: occupancy is a projection of SurfaceObject positions.
 */
export type Surface = {
  readonly id: SurfaceId;
  readonly spaceId: SpaceId;
  readonly createdAt: Date;
  readonly version: number;
};
