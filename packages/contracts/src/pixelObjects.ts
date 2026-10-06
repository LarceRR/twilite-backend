import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common';
import {
  PIXEL_OBJECT_FORMAT,
  PIXEL_OBJECT_CANVAS_MAX,
  pixelObjectAnimationSchema,
  pixelObjectManifestSchema,
} from './tpo';

export { PIXEL_OBJECT_FORMAT, PIXEL_OBJECT_CANVAS_MAX, pixelObjectManifestSchema };
export type { PixelObjectManifest } from './tpo';

/** `archived` is ADR-007 (P2-S5). */
export const pixelObjectStatusSchema = z.enum(['pending', 'published', 'rejected', 'archived']);

export const submitPixelObjectSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    projectId: uuidSchema,
    manifest: pixelObjectManifestSchema,
  })
  .strict();

export const reassignPixelObjectSchema = z
  .object({
    toProjectId: uuidSchema,
  })
  .strict();

export const rejectPixelObjectSchema = z
  .object({
    comment: z.string().trim().min(3).max(2000),
  })
  .strict();

const canvasSizeSchema = z.number().int().min(1).max(PIXEL_OBJECT_CANVAS_MAX);

export const pixelObjectCatalogItemSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  title: z.string(),
  status: pixelObjectStatusSchema.optional(),
  revision: z.number().int().min(1),
  manifest: pixelObjectManifestSchema,
  sheetUrl: z.string().min(1),
  previewUrl: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Full author/moderation DTO (includes author fields). */
export const pixelObjectDtoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  title: z.string(),
  authorDisplayName: z.string(),
  authorUserId: uuidSchema,
  status: pixelObjectStatusSchema,
  rejectionComment: z.string().nullable(),
  revision: z.number().int().min(1),
  manifest: pixelObjectManifestSchema,
  sheetUrl: z.string().min(1),
  previewUrl: z.string().nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  reviewedAt: isoDateTime.nullable(),
});

export const pixelObjectListSchema = z.object({
  items: z.array(pixelObjectDtoSchema),
  nextCursor: z.string().nullable().optional(),
});

/**
 * Mobile runtime DTO. Never exposes mediaId.
 * `revision` / `previewUrl` optional during compatibility window (ADR-015 / ADR-016).
 */
export const pixelObjectMobileSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    revision: z.number().int().min(1).optional(),
    format: z.literal(PIXEL_OBJECT_FORMAT),
    sheetUrl: z.string().min(1),
    previewUrl: z.string().nullable().optional(),
    canvas: z
      .object({
        width: canvasSizeSchema,
        height: canvasSizeSchema,
      })
      .strict(),
    sheet: z
      .object({
        frameWidth: canvasSizeSchema,
        frameHeight: canvasSizeSchema,
        columns: z.number().int().min(1),
        rows: z.number().int().min(1),
        frameCount: z.number().int().min(1),
      })
      .strict(),
    animations: z.array(pixelObjectAnimationSchema).length(1),
    staticPreviewFrame: z.number().int().min(0),
  })
  .strict();

export type SubmitPixelObjectDto = z.infer<typeof submitPixelObjectSchema>;
export type ReassignPixelObjectDto = z.infer<typeof reassignPixelObjectSchema>;
export type PixelObjectDto = z.infer<typeof pixelObjectDtoSchema>;
export type PixelObjectCatalogItem = z.infer<typeof pixelObjectCatalogItemSchema>;
export type PixelObjectMobileDto = z.infer<typeof pixelObjectMobileSchema>;
