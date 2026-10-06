import { Module } from '@nestjs/common';

import { ProjectsModule } from '@/modules/tpg-projects/projects.module';
import { AuditLogService } from '@/shared/audit/auditLog.service';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { MediaGcService } from './application/mediaGc.service';
import { PixelObjectsService } from './application/pixelObjects.service';
import { MediaGcProcessor } from './infrastructure/processors/mediaGc.processor';
import { PixelObjectsController } from './presentation/controllers/pixelObjects.controller';

@Module({
  imports: [ProjectsModule],
  controllers: [PixelObjectsController],
  providers: [
    PixelObjectsService,
    MediaGcService,
    IdempotencyService,
    AuditLogService,
    MediaGcProcessor,
  ],
  exports: [PixelObjectsService, MediaGcService],
})
export class PixelObjectsModule {}
