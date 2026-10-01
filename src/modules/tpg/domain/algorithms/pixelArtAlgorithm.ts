import { ValidationError } from '@/shared/errors';

/** Available TPG pixelation strategies. */
export const PIXEL_ART_ALGORITHMS = [
  'nearest',
  'quantize',
  'bayer',
  'floyd-steinberg',
  'atkinson',
  'center',
] as const;

export type PixelArtAlgorithm = (typeof PIXEL_ART_ALGORITHMS)[number];

/** Quantize+map without dither — usually the nicest “clean” pixel look. */
export const DEFAULT_PIXEL_ART_ALGORITHM: PixelArtAlgorithm = 'quantize';

export const DEFAULT_PALETTE_SIZE = 24;
export const MIN_PALETTE_SIZE = 2;
export const MAX_PALETTE_SIZE = 64;

export function normalizeAlgorithm(value: string | undefined): PixelArtAlgorithm {
  if (value === undefined) {
    return DEFAULT_PIXEL_ART_ALGORITHM;
  }

  if ((PIXEL_ART_ALGORITHMS as readonly string[]).includes(value)) {
    return value as PixelArtAlgorithm;
  }

  throw new ValidationError('Неизвестный алгоритм пикселизации', [
    {
      path: 'algorithm',
      message: `Допустимо: ${PIXEL_ART_ALGORITHMS.join(', ')}`,
    },
  ]);
}

export function normalizePaletteSize(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PALETTE_SIZE;
  }

  if (!Number.isInteger(value) || value < MIN_PALETTE_SIZE || value > MAX_PALETTE_SIZE) {
    throw new ValidationError('Некорректный размер палитры', [
      {
        path: 'paletteSize',
        message: `Ожидается целое число от ${MIN_PALETTE_SIZE} до ${MAX_PALETTE_SIZE}`,
      },
    ]);
  }

  return value;
}
