import { z } from 'zod';

import { uuidSchema } from './common';

export const PIXEL_OBJECT_FORMAT = 'twilite.pixelobject/v1' as const;

/** Catalog max canvas edge (ADR-002). */
export const PIXEL_OBJECT_CANVAS_MAX = 160;

export const PIXEL_OBJECT_MIN_FRAME_DURATION_MS = 16;
export const PIXEL_OBJECT_MAX_FRAME_DURATION_MS = 10_000;

/** Zod ceiling; live cap is limits.maxFrames (default 64). */
export const FRAME_COUNT_CEILING = 256;

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

export const pixelObjectAnimationSchema = z
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
    animations: z.array(pixelObjectAnimationSchema).length(1),
    staticPreviewFrame: z.number().int().min(0),
  })
  .strict()
  .superRefine((value, ctx) => {
    const { frameCount, columns, rows } = value.sheet;
    if (columns * rows < frameCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['sheet', 'columns'],
        message: 'Grid cells must be >= frameCount',
        params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
      });
    }

    const animation = value.animations[0];
    if (animation === undefined) {
      return;
    }

    if (animation.frames.length !== frameCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['animations', 0, 'frames'],
        message: 'Frame list length must equal frameCount',
        params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
      });
    }

    const seen = new Set<number>();
    for (const [index, ref] of animation.frames.entries()) {
      if (ref.frame < 0 || ref.frame >= frameCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['animations', 0, 'frames', index, 'frame'],
          message: 'Frame index out of range',
          params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
        });
      }
      if (seen.has(ref.frame)) {
        ctx.addIssue({
          code: 'custom',
          path: ['animations', 0, 'frames', index, 'frame'],
          message: 'Duplicate frame index',
          params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
        });
      }
      seen.add(ref.frame);
    }

    if (value.staticPreviewFrame < 0 || value.staticPreviewFrame >= frameCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['staticPreviewFrame'],
        message: 'staticPreviewFrame out of range',
        params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
      });
    }

    if (
      value.sheet.frameWidth !== value.canvas.width ||
      value.sheet.frameHeight !== value.canvas.height
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sheet', 'frameWidth'],
        message: 'frameWidth/frameHeight must equal canvas',
        params: { code: 'PIXEL_OBJECT_INVALID_MANIFEST' },
      });
    }
  });

export type PixelObjectManifest = z.infer<typeof pixelObjectManifestSchema>;
