import { Module } from '@nestjs/common';

import { SpacesModule } from '@/modules/spaces/spaces.module';

import { TimelineProjectionListener } from './application/listeners/timelineProjection.listener';
import { GetTimelineHandler } from './application/queries/getTimeline.handler';
import { TIMELINE_REPOSITORY } from './domain/repositories/TimelineRepository';
import { DrizzleTimelineRepository } from './infrastructure/repositories/drizzleTimelineRepository';
import { TimelineController } from './presentation/controllers/timeline.controller';

@Module({
  imports: [SpacesModule],
  controllers: [TimelineController],
  providers: [
    { provide: TIMELINE_REPOSITORY, useClass: DrizzleTimelineRepository },
    GetTimelineHandler,
    TimelineProjectionListener,
  ],
  exports: [TIMELINE_REPOSITORY],
})
export class TimelineModule {}
