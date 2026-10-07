import { Module } from '@nestjs/common';

import { RbacModule } from '@/modules/rbac/rbac.module';
import { ProjectsModule } from '@/modules/tpg-projects/projects.module';
import { AuditLogService } from '@/shared/audit/auditLog.service';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { CatalogProjectsService } from './application/catalogProjects.service';
import { MediaGcService } from './application/mediaGc.service';
import { PixelObjectsService } from './application/pixelObjects.service';
import { MediaGcProcessor } from './infrastructure/processors/mediaGc.processor';
import { PixelObjectsController } from './presentation/controllers/pixelObjects.controller';

@Module({
  imports: [ProjectsModule, RbacModule],
  controllers: [PixelObjectsController],
  providers: [
    PixelObjectsService,
    CatalogProjectsService,
    MediaGcService,
    IdempotencyService,
    AuditLogService,
    MediaGcProcessor,
  ],
  exports: [PixelObjectsService, MediaGcService],
})
export class PixelObjectsModule {}
