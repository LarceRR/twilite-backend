import {
  DEFAULT_PALETTE_SIZE,
  type PixelArtAlgorithm,
} from '../../domain/algorithms/pixelArtAlgorithm';
import { buildMedianCutPalette } from './buildMedianCutPalette';
import { ditherBayer } from './ditherBayer';
import { ditherAtkinson, ditherFloydSteinberg } from './ditherFloydSteinberg';
import { mapToPalette } from './mapToPalette';
import type { RawRgbaImage } from './rawRgba';

/** Apply the chosen colour strategy on the already-downsampled grid. */
export function applyColourAlgorithm(
  image: RawRgbaImage,
  algorithm: PixelArtAlgorithm,
  paletteSize = DEFAULT_PALETTE_SIZE,
): void {
  if (algorithm === 'nearest') {
    return;
  }

  const palette = buildMedianCutPalette(image.data, paletteSize);

  if (algorithm === 'quantize' || algorithm === 'center') {
    mapToPalette(image.data, palette);
    return;
  }

  if (algorithm === 'bayer') {
    ditherBayer(image, palette);
    return;
  }

  if (algorithm === 'atkinson') {
    ditherAtkinson(image, palette);
    return;
  }

  ditherFloydSteinberg(image, palette);
}
