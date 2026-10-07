import { z } from 'zod';

/** Authoritative client-facing limits (API LIMIT_DEFINITIONS remains source for values). */
export const pixelObjectLimitsSchema = z
  .object({
    canvasMax: z.number().int().min(1),
    maxFrames: z.number().int().min(1),
    sheetMaxBytes: z.number().int().min(1),
    minFrameDurationMs: z.number().int().min(1),
    maxFrameDurationMs: z.number().int().min(1),
    titleMax: z.number().int().min(1),
    surfaceMax: z.number().int().min(1),
    objectsPerProject: z.number().int().min(1),
    projectsPerUser: z.number().int().min(1),
    projectTitleMax: z.number().int().min(1),
    supportedFormat: z.literal('twilite.pixelobject/v1'),
  })
  .strict();

export type PixelObjectLimits = z.infer<typeof pixelObjectLimitsSchema>;

export const DEFAULT_PIXEL_OBJECT_LIMITS = {
  canvasMax: 160,
  maxFrames: 64,
  sheetMaxBytes: 8 * 1024 * 1024,
  minFrameDurationMs: 16,
  maxFrameDurationMs: 10_000,
  titleMax: 80,
  surfaceMax: 500,
  objectsPerProject: 100,
  projectsPerUser: 50,
  projectTitleMax: 80,
  supportedFormat: 'twilite.pixelobject/v1',
} as const satisfies PixelObjectLimits;
