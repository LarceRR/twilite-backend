import { AppError, InfrastructureError } from '@/shared/errors';

import {
  DEFAULT_PALETTE_SIZE,
  DEFAULT_PIXEL_ART_ALGORITHM,
  type PixelArtAlgorithm,
} from '../../domain/algorithms/pixelArtAlgorithm';
import type {
  PixelArtOptions,
  PixelArtProcessor,
  PixelArtResult,
} from '../../domain/ports/PixelArtProcessor';
import { applyColourAlgorithm } from '../algorithms/applyColourAlgorithm';
import {
  downsampleToGrid,
  encodeNativePng,
  fitInsideMaxEdge,
  hardenAlpha,
  readSize,
  upscaleNearest,
} from '../algorithms/imagePipeline';

/**
 * Fit → downsample → colour strategy → nearest upsample.
 * Intermediate buffers keep sharp from fusing the two resizes.
 */
export class SharpPixelArtProcessor implements PixelArtProcessor {
  async pixelate(source: Buffer, options: PixelArtOptions): Promise<PixelArtResult> {
    const algorithm = options.algorithm ?? DEFAULT_PIXEL_ART_ALGORITHM;
    const paletteSize = options.paletteSize ?? DEFAULT_PALETTE_SIZE;

    try {
      return await runPipeline(source, options.pixelSize, algorithm, paletteSize);
    } catch (origin) {
      if (origin instanceof AppError) throw origin;
      throw new InfrastructureError('Не удалось обработать изображение', {}, origin);
    }
  }
}

async function runPipeline(
  source: Buffer,
  pixelSize: number,
  algorithm: PixelArtAlgorithm,
  paletteSize: number,
): Promise<PixelArtResult> {
  const fitted = await fitInsideMaxEdge(source);
  const { width, height } = await readSize(fitted);
  const clampedPixel = Math.min(pixelSize, width, height);
  const gridW = Math.max(1, Math.floor(width / clampedPixel));
  const gridH = Math.max(1, Math.floor(height / clampedPixel));
  const downMode = algorithm === 'nearest' || algorithm === 'center' ? 'nearest' : 'average';
  const grid = await downsampleToGrid(fitted, gridW, gridH, downMode);

  applyColourAlgorithm(grid, algorithm, paletteSize);
  hardenAlpha(grid);

  const [nativeBuffer, buffer] = await Promise.all([
    encodeNativePng(grid),
    upscaleNearest(grid, width, height),
  ]);

  return {
    buffer,
    nativeBuffer,
    mimeType: 'image/png',
    width,
    height,
    nativeWidth: grid.width,
    nativeHeight: grid.height,
    pixelSize: clampedPixel,
    algorithm,
    paletteSize,
  };
}
