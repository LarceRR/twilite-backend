import { Module } from '@nestjs/common';

import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { ProjectsService } from './application/projects.service';
import { ProjectsController } from './presentation/controllers/projects.controller';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, IdempotencyService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
