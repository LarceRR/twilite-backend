import { Module } from '@nestjs/common';

import { AppThemesService } from './application/appThemes.service';
import { OpenRouterThemesService } from './infrastructure/openRouterThemes.service';
import { AppThemesController } from './presentation/controllers/appThemes.controller';

@Module({
  controllers: [AppThemesController],
  providers: [AppThemesService, OpenRouterThemesService],
})
export class AppThemesModule {}
