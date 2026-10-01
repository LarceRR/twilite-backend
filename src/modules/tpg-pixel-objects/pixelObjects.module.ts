import { Module } from '@nestjs/common';

import { PixelObjectsService } from './application/pixelObjects.service';
import { PixelObjectsController } from './presentation/controllers/pixelObjects.controller';

@Module({
  controllers: [PixelObjectsController],
  providers: [PixelObjectsService],
})
export class PixelObjectsModule {}
