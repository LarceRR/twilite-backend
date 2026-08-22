import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common.contract';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const createUploadRequestSchema = z.object({
  kind: z.enum(['image', 'voice', 'attachment']),
  contentType: z.string().min(3).max(120),
  byteSize: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  spaceId: uuidSchema.optional(),
});

/**
 * The API never proxies bytes: the client uploads straight to object storage with
 * a short-lived presigned URL, then confirms.
 */
export const uploadTicketSchema = z.object({
  assetId: uuidSchema,
  uploadUrl: z.string(),
  storageKey: z.string(),
  expiresAt: isoDateTime,
});

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  kind: z.enum(['image', 'voice', 'attachment']),
  url: z.string().nullable(),
  contentType: z.string(),
  byteSize: z.number().int(),
  status: z.enum(['pending', 'ready']),
  createdAt: isoDateTime,
});

export type UploadTicketDto = z.infer<typeof uploadTicketSchema>;
export type MediaAssetDto = z.infer<typeof mediaAssetSchema>;
