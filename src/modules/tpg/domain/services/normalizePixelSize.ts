import { ValidationError } from '@/shared/errors';

import { DEFAULT_PIXEL_SIZE, MAX_PIXEL_SIZE, MIN_PIXEL_SIZE } from '../constants';

/** Ensures pixelSize is a usable integer inside the allowed range. */
export function normalizePixelSize(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PIXEL_SIZE;
  }

  if (!Number.isInteger(value) || value < MIN_PIXEL_SIZE || value > MAX_PIXEL_SIZE) {
    throw new ValidationError('Некорректный размер пикселя', [
      {
        path: 'pixelSize',
        message: `Ожидается целое число от ${MIN_PIXEL_SIZE} до ${MAX_PIXEL_SIZE}`,
      },
    ]);
  }

  return value;
}
