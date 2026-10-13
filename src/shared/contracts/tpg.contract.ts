import { z } from 'zod';

import {
  DEFAULT_PALETTE_SIZE,
  DEFAULT_PIXEL_ART_ALGORITHM,
  MAX_PALETTE_SIZE,
  MIN_PALETTE_SIZE,
  PIXEL_ART_ALGORITHMS,
} from '@/modules/tpg/domain/algorithms/pixelArtAlgorithm';

export { DEFAULT_PALETTE_SIZE, DEFAULT_PIXEL_ART_ALGORITHM, PIXEL_ART_ALGORITHMS };

/** Longest side of a fitted TPG image (aspect ratio preserved). */
export const TPG_MAX_EDGE = 400;

export const pixelArtAlgorithmSchema = z.enum(PIXEL_ART_ALGORITHMS);

export const pixelateFromUrlRequestSchema = z.object({
  imageUrl: z.url(),
  /** Edge length of one pixel block in the fitted result. */
  pixelSize: z.coerce.number().int().min(2).max(100).default(8),
  algorithm: pixelArtAlgorithmSchema.default(DEFAULT_PIXEL_ART_ALGORITHM),
  paletteSize: z.coerce
    .number()
    .int()
    .min(MIN_PALETTE_SIZE)
    .max(MAX_PALETTE_SIZE)
    .default(DEFAULT_PALETTE_SIZE),
});

export const pixelateResponseSchema = z.object({
  mimeType: z.literal('image/png'),
  width: z.number().int().positive().max(TPG_MAX_EDGE),
  height: z.number().int().positive().max(TPG_MAX_EDGE),
  /** Upscaled preview (nearest-neighbour blocks). */
  imageBase64: z.string().min(1),
  /** True 1:1 pixel grid for editors / game assets. */
  nativeWidth: z.number().int().positive(),
  nativeHeight: z.number().int().positive(),
  nativeBase64: z.string().min(1),
  pixelSize: z.number().int(),
  paletteSize: z.number().int(),
  algorithm: pixelArtAlgorithmSchema,
});

export type PixelateFromUrlRequestDto = z.infer<typeof pixelateFromUrlRequestSchema>;
export type PixelateResponseDto = z.infer<typeof pixelateResponseSchema>;
