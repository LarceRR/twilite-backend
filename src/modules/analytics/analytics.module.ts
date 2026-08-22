import { Module } from '@nestjs/common';

import { AnalyticsProcessor } from './infrastructure/processors/analytics.processor';
import { AnalyticsController } from './presentation/controllers/analytics.controller';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsProcessor],
})
export class AnalyticsModule {}
