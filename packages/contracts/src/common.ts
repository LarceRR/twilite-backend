import { z } from 'zod';

export const isoDateTime = z.string().describe('ISO 8601 timestamp');

export const uuidSchema = z.string().uuid();

export const versionSchema = z
  .number()
  .int()
  .min(1)
  .describe('Aggregate version for optimistic locking');

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
