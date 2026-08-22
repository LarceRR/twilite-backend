import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { AiInsightDto } from '@/shared/contracts/ai.contract';
import { aiInsightSchema, generateInsightRequestSchema } from '@/shared/contracts/ai.contract';
import {
  type AuthenticatedUser,
  CurrentUser,
  RequirePermission,
} from '@/shared/decorators/auth.decorators';

import { GenerateInsightHandler } from '../../application/commands/generateInsight.handler';

class GenerateInsightDto extends createZodDto(generateInsightRequestSchema) {}
class AiInsightResponseDto extends createZodDto(aiInsightSchema) {}

@ApiTags('ai')
@Controller('spaces/:spaceId/ai')
export class AiController {
  constructor(private readonly insights: GenerateInsightHandler) {}

  @Post('insights')
  @RequirePermission('space.view')
  @ApiOperation({ summary: 'Сгенерировать наблюдение по пространству' })
  @ApiOkResponse({ type: AiInsightResponseDto })
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
    @Body() body: GenerateInsightDto,
  ): Promise<AiInsightDto> {
    return this.insights.execute({
      spaceId: spaceId as SpaceId,
      userId: user.userId,
      windowDays: body.windowDays,
    });
  }

  @Get('insights/latest')
  @RequirePermission('space.view')
  @ApiOperation({ summary: 'Последнее наблюдение' })
  @ApiOkResponse({ type: AiInsightResponseDto })
  async latest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
  ): Promise<AiInsightDto> {
    return this.insights.latest(spaceId as SpaceId, user.userId);
  }
}
