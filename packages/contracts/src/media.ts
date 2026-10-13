import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const mediaKindSchema = z.enum([
  'image',
  'voice',
  'attachment',
  'avatar',
  'project-avatar',
  'pixel-sheet',
]);

export const mediaAssetStatusSchema = z.enum(['pending', 'ready', 'rejected']);

export const createUploadRequestSchema = z.object({
  kind: z.enum(['image', 'voice', 'attachment', 'pixel-sheet']),
  contentType: z.string().min(3).max(120),
  byteSize: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  spaceId: uuidSchema.optional(),
});

export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const createAvatarUploadRequestSchema = z.object({
  contentType: z.enum(AVATAR_CONTENT_TYPES),
  byteSize: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export const uploadTicketSchema = z.object({
  assetId: uuidSchema,
  uploadUrl: z.string(),
  storageKey: z.string(),
  expiresAt: isoDateTime,
  headers: z.object({
    'Content-Type': z.string(),
    'Cache-Control': z.string(),
  }),
});

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  kind: mediaKindSchema,
  url: z.string().nullable(),
  contentType: z.string(),
  byteSize: z.number().int(),
  status: mediaAssetStatusSchema,
  createdAt: isoDateTime,
});

export type UploadTicketDto = z.infer<typeof uploadTicketSchema>;
export type MediaAssetDto = z.infer<typeof mediaAssetSchema>;
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type CreateAvatarUploadRequest = z.infer<typeof createAvatarUploadRequestSchema>;
