import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common.contract';

export const PIXEL_OBJECT_FORMAT = 'twilite.pixelobject/v1' as const;

/** Editor canvas is 160×160. Sheet cells use the same size. */
export const PIXEL_OBJECT_CANVAS_MAX = 160;

export const PIXEL_OBJECT_MIN_FRAME_DURATION_MS = 16;
export const PIXEL_OBJECT_MAX_FRAME_DURATION_MS = 10_000;

/**
 * Zod ceiling. The live cap is `LIMIT_TPG_PIXEL_OBJECT_MAX_FRAMES`
 * (production default 64), enforced again in the service.
 */
const FRAME_COUNT_CEILING = 256;

const canvasSizeSchema = z.number().int().min(1).max(PIXEL_OBJECT_CANVAS_MAX);

const frameRefSchema = z
  .object({
    frame: z.number().int().min(0),
    durationMs: z
      .number()
      .int()
      .min(PIXEL_OBJECT_MIN_FRAME_DURATION_MS)
      .max(PIXEL_OBJECT_MAX_FRAME_DURATION_MS),
  })
  .strict();

const animationSchema = z
  .object({
    id: z.literal('default'),
    loop: z.literal(true),
    frames: z.array(frameRefSchema).min(1).max(FRAME_COUNT_CEILING),
  })
  .strict();

export const pixelObjectManifestSchema = z
  .object({
    format: z.literal(PIXEL_OBJECT_FORMAT),
    canvas: z
      .object({
        width: canvasSizeSchema,
        height: canvasSizeSchema,
      })
      .strict(),
    sheet: z
      .object({
        mediaId: uuidSchema,
        frameWidth: canvasSizeSchema,
        frameHeight: canvasSizeSchema,
        columns: z.number().int().min(1).max(FRAME_COUNT_CEILING),
        rows: z.number().int().min(1).max(FRAME_COUNT_CEILING),
        frameCount: z.number().int().min(1).max(FRAME_COUNT_CEILING),
      })
      .strict(),
    animations: z.array(animationSchema).length(1),
    staticPreviewFrame: z.number().int().min(0),
  })
  .strict();

export const pixelObjectStatusSchema = z.enum(['pending', 'published', 'rejected']);

export const submitPixelObjectSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    manifest: pixelObjectManifestSchema,
  })
  .strict();

export const rejectPixelObjectSchema = z
  .object({
    comment: z.string().trim().min(3).max(2000),
  })
  .strict();

export const pixelObjectDtoSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  authorDisplayName: z.string(),
  authorUserId: uuidSchema,
  status: pixelObjectStatusSchema,
  rejectionComment: z.string().nullable(),
  revision: z.number().int().min(1),
  manifest: pixelObjectManifestSchema,
  sheetUrl: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  reviewedAt: isoDateTime.nullable(),
});

export const pixelObjectListSchema = z.object({
  items: z.array(pixelObjectDtoSchema),
});

export const pixelObjectMobileSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    format: z.literal(PIXEL_OBJECT_FORMAT),
    sheetUrl: z.string().min(1),
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
    animations: z.array(animationSchema).length(1),
    staticPreviewFrame: z.number().int().min(0),
  })
  .strict();

export type PixelObjectManifest = z.infer<typeof pixelObjectManifestSchema>;
export type SubmitPixelObjectDto = z.infer<typeof submitPixelObjectSchema>;
export type PixelObjectDto = z.infer<typeof pixelObjectDtoSchema>;
export type PixelObjectMobileDto = z.infer<typeof pixelObjectMobileSchema>;
