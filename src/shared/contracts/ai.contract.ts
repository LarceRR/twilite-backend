import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common.contract';

export const aiInsightSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  status: z.enum(['pending', 'ready', 'failed']),
  summary: z.string().nullable(),
  suggestions: z.array(z.string()),
  createdAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
});

export const generateInsightRequestSchema = z.object({
  /** How far back the context builder looks. */
  windowDays: z.coerce.number().int().min(1).max(90).default(30),
});

export type AiInsightDto = z.infer<typeof aiInsightSchema>;
