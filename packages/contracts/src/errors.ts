import { z } from 'zod';

/**
 * Stable machine-readable codes for sprite/media/tpg surfaces.
 * Clients branch on `code`, never on localized messages.
 */
export const CONTRACT_ERROR_CODES = [
  'MEDIA_UPLOAD_FORBIDDEN',
  'MEDIA_OBJECT_MISSING',
  'MEDIA_SIZE_MISMATCH',
  'MEDIA_CONTENT_TYPE_MISMATCH',
  'MEDIA_QUOTA_EXCEEDED',
  'PIXEL_OBJECT_INVALID_MANIFEST',
  'PIXEL_OBJECT_NOT_FOUND',
  'PIXEL_OBJECT_NOT_PUBLISHED',
  'PIXEL_OBJECT_SELF_MODERATION',
  'PIXEL_OBJECT_PENDING',
  'PIXEL_OBJECT_FORBIDDEN',
  'PROJECT_NOT_FOUND',
  'PROJECT_FORBIDDEN',
  'PROJECT_OBJECT_LIMIT',
  'PROJECT_OWNER_LIMIT',
  'SURFACE_FULL',
  'SURFACE_METADATA_TOO_LARGE',
  'IDEMPOTENCY_CONFLICT',
  'CONTRACT_INVALID',
  'STORAGE_UNAVAILABLE',
] as const;

export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];

export const contractErrorCodeSchema = z.enum(CONTRACT_ERROR_CODES);

/** Legacy envelope codes still used by the Nest AppError layer. */
export const LEGACY_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'DOMAIN_RULE_VIOLATION',
  'INFRASTRUCTURE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type LegacyErrorCode = (typeof LEGACY_ERROR_CODES)[number];

export const errorCodeSchema = z.enum([...LEGACY_ERROR_CODES, ...CONTRACT_ERROR_CODES]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
  /** @deprecated Prefer `code` only; kept during compatibility window. */
  kind: z
    .enum([
      'validation',
      'domain',
      'infrastructure',
      'authentication',
      'authorization',
      'notFound',
      'conflict',
      'unknown',
    ])
    .optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** HTTP status mapping from 04-CONTRACTS §5. */
export const CONTRACT_ERROR_HTTP_STATUS: Readonly<Record<ContractErrorCode, number>> = {
  MEDIA_UPLOAD_FORBIDDEN: 403,
  MEDIA_OBJECT_MISSING: 422,
  MEDIA_SIZE_MISMATCH: 422,
  MEDIA_CONTENT_TYPE_MISMATCH: 422,
  MEDIA_QUOTA_EXCEEDED: 429,
  PIXEL_OBJECT_INVALID_MANIFEST: 422,
  PIXEL_OBJECT_NOT_FOUND: 404,
  PIXEL_OBJECT_NOT_PUBLISHED: 409,
  PIXEL_OBJECT_SELF_MODERATION: 403,
  PIXEL_OBJECT_PENDING: 409,
  PIXEL_OBJECT_FORBIDDEN: 403,
  PROJECT_NOT_FOUND: 404,
  PROJECT_FORBIDDEN: 403,
  PROJECT_OBJECT_LIMIT: 409,
  PROJECT_OWNER_LIMIT: 409,
  SURFACE_FULL: 409,
  SURFACE_METADATA_TOO_LARGE: 400,
  IDEMPOTENCY_CONFLICT: 409,
  CONTRACT_INVALID: 400,
  STORAGE_UNAVAILABLE: 503,
};
