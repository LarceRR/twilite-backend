import { z } from 'zod';

import { timelineEventTypes } from '@/modules/timeline/domain/entities/TimelineEvent';

import { isoDateTime, uuidSchema } from './common.contract';

export const timelineEventSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  type: z.enum(timelineEventTypes),
  actorUserId: uuidSchema.nullable(),
  subjectUserId: uuidSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: isoDateTime,
});

export const timelinePageSchema = z.object({
  events: z.array(timelineEventSchema),
  nextCursor: z.string().nullable(),
});

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
  types: z.string().optional().describe('Comma separated TimelineEventType values'),
});

export const statisticsSchema = z.object({
  totalObjects: z.number().int(),
  byKind: z.record(z.string(), z.number().int()),
  favorites: z.number().int(),
  balance: z.number(),
  firstObjectAt: isoDateTime.nullable(),
  lastObjectAt: isoDateTime.nullable(),
});

export type TimelineEventDto = z.infer<typeof timelineEventSchema>;
export type TimelinePageDto = z.infer<typeof timelinePageSchema>;
export type StatisticsDto = z.infer<typeof statisticsSchema>;
