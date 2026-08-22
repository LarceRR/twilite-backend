import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { StatisticsDto, TimelinePageDto } from '@/shared/contracts/timeline.contract';
import {
  statisticsSchema,
  timelinePageSchema,
  timelineQuerySchema,
} from '@/shared/contracts/timeline.contract';
import {
  type AuthenticatedUser,
  CurrentUser,
  RequirePermission,
} from '@/shared/decorators/auth.decorators';

import { GetTimelineHandler } from '../../application/queries/getTimeline.handler';

class TimelineQueryDto extends createZodDto(timelineQuerySchema) {}
class TimelinePageResponseDto extends createZodDto(timelinePageSchema) {}
class StatisticsResponseDto extends createZodDto(statisticsSchema) {}

@ApiTags('timeline')
@Controller('spaces/:spaceId/timeline')
export class TimelineController {
  constructor(private readonly timeline: GetTimelineHandler) {}

  @Get()
  @RequirePermission('space.view')
  @ApiOperation({ summary: 'История пространства (keyset-пагинация)' })
  @ApiOkResponse({ type: TimelinePageResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
    @Query() query: TimelineQueryDto,
  ): Promise<TimelinePageDto> {
    return this.timeline.execute({
      spaceId: spaceId as SpaceId,
      userId: user.userId,
      limit: query.limit,
      cursor: query.cursor ?? null,
      types: query.types ?? null,
    });
  }

  @Get('statistics')
  @RequirePermission('space.view')
  @ApiOperation({ summary: 'Статистика по объектам пространства' })
  @ApiOkResponse({ type: StatisticsResponseDto })
  async statistics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
  ): Promise<StatisticsDto> {
    return this.timeline.statistics(spaceId as SpaceId, user.userId);
  }
}
