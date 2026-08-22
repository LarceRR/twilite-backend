import { Inject, Injectable } from '@nestjs/common';

import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';

import type { Surface } from '../../domain/entities/Surface';
import {
  SURFACE_REPOSITORY,
  type SurfaceRepository,
} from '../../domain/repositories/SurfaceRepository';

/**
 * Every space has exactly one surface. Older spaces (or a partially applied
 * migration) may predate that rule, so resolving creates it on demand instead of
 * failing the request.
 */
@Injectable()
export class SurfaceResolverService {
  constructor(@Inject(SURFACE_REPOSITORY) private readonly surfaces: SurfaceRepository) {}

  async resolve(spaceId: SpaceId): Promise<Surface> {
    const existing = await this.surfaces.findBySpaceId(spaceId);

    return existing ?? this.surfaces.create(spaceId);
  }
}
