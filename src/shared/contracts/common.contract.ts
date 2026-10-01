import { z } from 'zod';

/**
 * The contracts in this folder are the single source of truth for the HTTP API:
 * request validation, response typing and the published OpenAPI schema all come
 * from here, and the client mirrors them one to one.
 */
export const isoDateTime = z.string().describe('ISO 8601 timestamp');

export const uuidSchema = z.string().uuid();

export const versionSchema = z
  .number()
  .int()
  .min(1)
  .describe('Aggregate version for optimistic locking');

export const errorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'DOMAIN_RULE_VIOLATION',
  'INFRASTRUCTURE_UNAVAILABLE',
  'INTERNAL_ERROR',
  'MEDIA_UPLOAD_FORBIDDEN',
  'MEDIA_OBJECT_MISSING',
  'MEDIA_SIZE_MISMATCH',
  'MEDIA_CONTENT_TYPE_MISMATCH',
  'MEDIA_QUOTA_EXCEEDED',
  'STORAGE_UNAVAILABLE',
]);

export const errorResponseSchema = z.object({
  kind: z.enum([
    'validation',
    'domain',
    'infrastructure',
    'authentication',
    'authorization',
    'notFound',
    'conflict',
    'unknown',
  ]),
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});
