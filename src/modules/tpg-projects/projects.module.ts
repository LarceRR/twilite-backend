import { Module } from '@nestjs/common';

import { AuditLogService } from '@/shared/audit/auditLog.service';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { ProjectsService } from './application/projects.service';
import { ProjectsController } from './presentation/controllers/projects.controller';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, IdempotencyService, AuditLogService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
