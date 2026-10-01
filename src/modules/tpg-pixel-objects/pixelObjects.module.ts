import { Module } from '@nestjs/common';

import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { MediaGcService } from './application/mediaGc.service';
import { PixelObjectsService } from './application/pixelObjects.service';
import { PixelObjectsController } from './presentation/controllers/pixelObjects.controller';

@Module({
  controllers: [PixelObjectsController],
  providers: [PixelObjectsService, MediaGcService, IdempotencyService],
  exports: [PixelObjectsService],
})
export class PixelObjectsModule {}
