import { forwardRef, Module } from '@nestjs/common';

import { DrizzleModule } from '@/database/drizzle/drizzle.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { SurfacesModule } from '@/modules/surfaces/surfaces.module';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { ChangeSurfaceObjectStateHandler } from './application/commands/changeSurfaceObjectState.handler';
import { CreateSurfaceObjectHandler } from './application/commands/createSurfaceObject.handler';
import { UpdateSurfaceObjectHandler } from './application/commands/updateSurfaceObject.handler';
import { SURFACE_OBJECT_REPOSITORY } from './domain/repositories/SurfaceObjectRepository';
import { SurfaceLifecycleProcessor } from './infrastructure/processors/surfaceLifecycle.processor';
import { DrizzleSurfaceObjectRepository } from './infrastructure/repositories/drizzleSurfaceObjectRepository';
import { SurfaceObjectsController } from './presentation/controllers/surfaceObjects.controller';

@Module({
  imports: [DrizzleModule, forwardRef(() => SpacesModule), forwardRef(() => SurfacesModule)],
  controllers: [SurfaceObjectsController],
  providers: [
    { provide: SURFACE_OBJECT_REPOSITORY, useClass: DrizzleSurfaceObjectRepository },
    IdempotencyService,
    CreateSurfaceObjectHandler,
    ChangeSurfaceObjectStateHandler,
    UpdateSurfaceObjectHandler,
    SurfaceLifecycleProcessor,
  ],
  exports: [SURFACE_OBJECT_REPOSITORY],
})
export class SurfaceObjectsModule {}
