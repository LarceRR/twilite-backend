import { forwardRef, Module } from '@nestjs/common';

import { SpacesModule } from '@/modules/spaces/spaces.module';
import { SurfaceObjectsModule } from '@/modules/surface-objects/surfaceObjects.module';

import { GetSurfaceSnapshotHandler } from './application/queries/getSurfaceSnapshot.handler';
import { SurfaceResolverService } from './application/services/surfaceResolver.service';
import { SURFACE_REPOSITORY } from './domain/repositories/SurfaceRepository';
import { DrizzleSurfaceRepository } from './infrastructure/repositories/drizzleSurfaceRepository';
import { SurfacesController } from './presentation/controllers/surfaces.controller';

/**
 * Spaces create surfaces and surfaces read objects, so the graph has cycles at the
 * module level even though the dependencies inside are one-directional.
 */
@Module({
  imports: [forwardRef(() => SpacesModule), forwardRef(() => SurfaceObjectsModule)],
  controllers: [SurfacesController],
  providers: [
    { provide: SURFACE_REPOSITORY, useClass: DrizzleSurfaceRepository },
    SurfaceResolverService,
    GetSurfaceSnapshotHandler,
  ],
  exports: [SURFACE_REPOSITORY, SurfaceResolverService],
})
export class SurfacesModule {}
