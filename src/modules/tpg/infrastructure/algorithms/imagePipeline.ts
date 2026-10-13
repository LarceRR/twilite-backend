import sharp from 'sharp';

import { InfrastructureError, ValidationError } from '@/shared/errors';

import { MAX_EDGE } from '../../domain/constants';
import { createRawRgba, type RawRgbaImage, sampleAt } from './rawRgba';

/** Scale so neither side exceeds MAX_EDGE; never stretch. Keeps alpha. */
export async function fitInsideMaxEdge(source: Buffer): Promise<Buffer> {
  try {
    return await sharp(source, {
      animated: false,
      limitInputPixels: 64 * 1024 * 1024,
      failOn: 'error',
    })
      .rotate()
      .ensureAlpha()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside' })
      .png()
      .toBuffer();
  } catch (origin) {
    throw new ValidationError(
      'Файл не является изображением',
      [{ path: 'image', message: 'Не удалось декодировать PNG/JPEG/WebP/GIF' }],
      { origin: String(origin) },
    );
  }
}

export async function readSize(image: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(image).metadata();
  if (meta.width === undefined || meta.height === undefined) {
    throw new InfrastructureError('Не удалось определить размер изображения');
  }
  return { width: meta.width, height: meta.height };
}

/** Shrink to the pixel grid. `average` keeps more colour; `nearest` keeps hard edges. */
export async function downsampleToGrid(
  image: Buffer,
  gridW: number,
  gridH: number,
  mode: 'nearest' | 'average',
): Promise<RawRgbaImage> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .resize(gridW, gridH, {
      kernel: mode === 'nearest' ? sharp.kernel.nearest : sharp.kernel.cubic,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return createRawRgba(info.width, info.height, new Uint8ClampedArray(data));
}

/** Encode the tiny RGBA grid as PNG (true 1:1 pixel art). */
export async function encodeNativePng(image: RawRgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Upscale the tiny RGBA grid with nearest-neighbour so blocks stay crisp. */
export async function upscaleNearest(
  image: RawRgbaImage,
  width: number,
  height: number,
): Promise<Buffer> {
  const smallPng = await encodeNativePng(image);

  return sharp(smallPng).resize(width, height, { kernel: sharp.kernel.nearest }).png().toBuffer();
}

/** Soft anti-aliased edges → hard sprite alpha (good for game assets). */
export function hardenAlpha(image: RawRgbaImage, cutoff = 128): void {
  for (let i = 3; i < image.data.length; i += 4) {
    image.data[i] = sampleAt(image.data, i) >= cutoff ? 255 : 0;
    if (image.data[i] === 0) {
      image.data[i - 3] = 0;
      image.data[i - 2] = 0;
      image.data[i - 1] = 0;
    }
  }
}
