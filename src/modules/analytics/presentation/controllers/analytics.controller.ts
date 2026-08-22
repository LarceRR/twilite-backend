import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { jobNames, queueNames } from '@/infrastructure/queue/queue.constants';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';

const trackEventsSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        properties: z.record(z.string(), z.unknown()).default({}),
        occurredAt: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

class TrackEventsDto extends createZodDto(trackEventsSchema) {}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(@InjectQueue(queueNames.analytics) private readonly queue: Queue) {}

  /**
   * Accepted and queued: analytics must never make a user wait, and a failure here
   * must never fail their action.
   */
  @Post('events')
  @HttpCode(202)
  @ApiOperation({ summary: 'Отправить пакет продуктовых событий' })
  async track(@CurrentUser() user: AuthenticatedUser, @Body() body: TrackEventsDto): Promise<void> {
    await this.queue.addBulk(
      body.events.map((event) => ({
        name: jobNames.trackEvent,
        data: { ...event, userId: user.userId },
      })),
    );
  }
}
