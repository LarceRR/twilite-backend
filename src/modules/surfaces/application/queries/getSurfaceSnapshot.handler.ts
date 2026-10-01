import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { cacheKeys, cacheTtl } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { toSurfaceObjectDto } from '@/modules/surface-objects/application/mappers/surfaceObject.mapper';
import { loadPublishedMobileByIds } from '@/modules/surface-objects/application/loadPublishedMobileByIds';
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
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly access: SpaceAccessService,
    private readonly surfaceResolver: SurfaceResolverService,
  ) {}

  async execute(spaceId: SpaceId, userId: UserId): Promise<SurfaceSnapshotDto> {
    await this.access.assertPermission(spaceId, userId, 'surface.view');

    return this.cache.remember(
      cacheKeys.surfaceSnapshot(spaceId),
      cacheTtl.surfaceSnapshot,
      async () => {
        const surface = await this.surfaceResolver.resolve(spaceId);
        const objects = await this.objects.listBySurface(surface.id);
        const pixelIds = objects
          .map((object) => object.pixelObjectId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        const embeds = await loadPublishedMobileByIds(this.db, this.storage, pixelIds);

        return {
          surface: {
            id: surface.id,
            spaceId: surface.spaceId,
            bounds: boundsFromCells(objects.map((object) => object.cell)),
            version: surface.version,
          },
          objects: objects.map((object) => {
            const dto = toSurfaceObjectDto(object);
            const pixelObjectId =
              object.pixelObjectId ??
              (typeof object.metadata.pixelObjectId === 'string'
                ? object.metadata.pixelObjectId
                : null);
            const pixelObject =
              pixelObjectId === null ? null : (embeds.get(pixelObjectId) ?? null);
            return { ...dto, pixelObjectId, pixelObject };
          }),
        };
      },
    );
  }
}
