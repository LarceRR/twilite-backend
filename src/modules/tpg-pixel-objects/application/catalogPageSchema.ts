import {
  FRAME_COUNT_CEILING,
  PIXEL_OBJECT_CANVAS_MAX,
  PIXEL_OBJECT_MAX_FRAME_DURATION_MS,
  PIXEL_OBJECT_MIN_FRAME_DURATION_MS,
  uuidSchema,
} from '@twilite/contracts';
import { z } from 'zod';

import { CATALOG_MOMENTS_PER_PROJECT } from './catalogProjectsQuery';

const canvasEdge = z.number().int().min(1).max(PIXEL_OBJECT_CANVAS_MAX);
const frameIndex = z.number().int().min(0);
const durationMs = z
  .number()
  .int()
  .min(PIXEL_OBJECT_MIN_FRAME_DURATION_MS)
  .max(PIXEL_OBJECT_MAX_FRAME_DURATION_MS);

/**
 * Mobile catalog sprite. Field list is closed on purpose: `mediaId` and
 * storage keys from the manifest must not pass through.
 */
export const catalogSpriteSchema = z
  .object({
    sheetUrl: z.string().min(1),
    frameWidth: canvasEdge,
    frameHeight: canvasEdge,
    columns: z.number().int().min(1).max(FRAME_COUNT_CEILING),
    rows: z.number().int().min(1).max(FRAME_COUNT_CEILING),
    frameCount: z.number().int().min(1).max(FRAME_COUNT_CEILING),
    frames: z
      .array(
        z
          .object({
            frame: frameIndex,
            durationMs,
          })
          .strict(),
      )
      .min(1)
      .max(FRAME_COUNT_CEILING),
    staticPreviewFrame: frameIndex,
  })
  .strict();

export const catalogMomentSchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1).max(80),
    previewUrl: z.string().min(1).nullable(),
    sprite: catalogSpriteSchema.nullable(),
  })
  .strict();

export const catalogProjectSchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1).max(80),
    authorDisplayName: z.string().min(1).max(80),
    avatarUrl: z.string().min(1).nullable(),
    official: z.boolean(),
    objectCount: z.number().int().min(0),
    byteSize: z.number().int().min(0),
    moments: z.array(catalogMomentSchema).max(CATALOG_MOMENTS_PER_PROJECT),
  })
  .strict();

export const catalogPageSchema = z
  .object({
    items: z.array(catalogProjectSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export type CatalogSpriteDto = z.infer<typeof catalogSpriteSchema>;
export type CatalogMomentDto = z.infer<typeof catalogMomentSchema>;
export type CatalogProjectDto = z.infer<typeof catalogProjectSchema>;
export type CatalogPageDto = z.infer<typeof catalogPageSchema>;
