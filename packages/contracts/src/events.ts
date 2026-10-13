import { z } from 'zod';

import { uuidSchema } from './common';
import { pixelObjectMobileSchema, pixelObjectStatusSchema } from './pixelObjects';

export const catalogRealtimeEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('pixel_object.published'),
      pixelObjectId: uuidSchema,
      revision: z.number().int().min(1),
      mobile: pixelObjectMobileSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('pixel_object.status_changed'),
      pixelObjectId: uuidSchema,
      revision: z.number().int().min(1),
      status: pixelObjectStatusSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('pixel_object.archived'),
      pixelObjectId: uuidSchema,
      revision: z.number().int().min(1),
    })
    .strict(),
]);

export type CatalogRealtimeEvent = z.infer<typeof catalogRealtimeEventSchema>;
