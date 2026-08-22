import { Inject, Injectable } from '@nestjs/common';

import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { toSurfaceObjectDto } from '@/modules/surface-objects/application/mappers/surfaceObject.mapper';
import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '@/modules/surface-objects/domain/repositories/SurfaceObjectRepository';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { SurfaceSnapshotDto } from '@/shared/contracts/surface.contract';

import { boundsFromCells } from '../../domain/value-objects/SurfaceBounds';
import { SurfaceResolverService } from '../services/surfaceResolver.service';

@Injectable()
export class GetSurfaceSnapshotHandler {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    @Inject(CACHE) private readonly cache: Cache,
    private readonly access: SpaceAccessService,
    private readonly surfaceResolver: SurfaceResolverService,
  ) {}

  /**
   * The whole scene in one response: the client needs every object to render the
   * surface, and the payload stays small because empty cells do not exist.
   */
  async execute(spaceId: SpaceId, userId: UserId): Promise<SurfaceSnapshotDto> {
    await this.access.assertPermission(spaceId, userId, 'surface.view');

    return this.cache.remember(
      cacheKeys.surfaceSnapshot(spaceId),
      cacheTtl.surfaceSnapshot,
      async () => {
        const surface = await this.surfaceResolver.resolve(spaceId);
        const objects = await this.objects.listBySurface(surface.id);

        return {
          surface: {
            id: surface.id,
            spaceId: surface.spaceId,
            bounds: boundsFromCells(objects.map((object) => object.cell)),
            version: surface.version,
          },
          objects: objects.map(toSurfaceObjectDto),
        };
      },
    );
  }
}
