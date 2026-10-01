import { z } from 'zod';

import { uuidSchema } from './common';
import { pixelObjectMobileSchema } from './pixelObjects';

/** Reserved metadata key during compatibility; prefer first-class FK (ADR-004). */
export const LEGACY_PIXEL_OBJECT_METADATA_KEY = 'pixelObjectId' as const;

export const surfacePixelBindingSchema = z
  .object({
    pixelObjectId: uuidSchema.nullable(),
    pixelObject: pixelObjectMobileSchema.nullable(),
  })
  .strict();

export type SurfacePixelBinding = z.infer<typeof surfacePixelBindingSchema>;

export const createSurfaceObjectWithBindingSchema = z.object({
  kind: z.string().min(1).max(40),
  subjectUserId: uuidSchema.optional(),
  pixelObjectId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type CreateSurfaceObjectWithBinding = z.infer<typeof createSurfaceObjectWithBindingSchema>;
