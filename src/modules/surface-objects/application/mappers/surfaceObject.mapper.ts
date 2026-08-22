import type { SurfaceObjectDto } from '@/shared/contracts/surface.contract';

import type { SurfaceObject } from '../../domain/entities/SurfaceObject';

/**
 * The only bridge between the aggregate and the wire format. DTOs are never used
 * as domain models, and the domain never leaks Dates or branded ids outward.
 */
export function toSurfaceObjectDto(object: SurfaceObject): SurfaceObjectDto {
  return {
    id: object.id,
    spaceId: object.spaceId,
    surfaceId: object.surfaceId,
    cellX: object.cell.x,
    cellY: object.cell.y,
    kind: object.kind,
    state: object.state,
    createdByUserId: object.createdByUserId,
    subjectUserId: object.subjectUserId,
    metadata: object.metadata,
    favorite: object.favorite,
    createdAt: object.createdAt.toISOString(),
    updatedAt: object.updatedAt.toISOString(),
    version: object.version,
  };
}
