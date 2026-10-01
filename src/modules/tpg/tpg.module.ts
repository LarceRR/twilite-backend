import { Module } from '@nestjs/common';

import { GeneratePixelArtHandler } from './application/commands/generatePixelArt.handler';
import { PIXEL_ART_PROCESSOR } from './domain/ports/PixelArtProcessor';
import { SharpPixelArtProcessor } from './infrastructure/providers/sharpPixelArtProcessor';
import { TpgController } from './presentation/controllers/tpg.controller';

@Module({
  controllers: [TpgController],
  providers: [
    { provide: PIXEL_ART_PROCESSOR, useClass: SharpPixelArtProcessor },
    GeneratePixelArtHandler,
  ],
})
export class TpgModule {}
