import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppLimits } from '@/config/limits';
import { ValidationError } from '@/shared/errors';
import type { PixelArtProcessor } from '../../domain/ports/PixelArtProcessor';
import { GeneratePixelArtHandler } from './generatePixelArt.handler';

const limits = {
  tpg: { imageMaxBytes: 1024 },
} as AppLimits;

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('GeneratePixelArtHandler', () => {
  const pixelate = vi.fn();
  const processor: PixelArtProcessor = { pixelate };
  let handler: GeneratePixelArtHandler;

  beforeEach(() => {
    pixelate.mockReset();
    pixelate.mockResolvedValue({
      buffer: Buffer.from('png'),
      nativeBuffer: Buffer.from('tiny'),
      mimeType: 'image/png',
      width: 400,
      height: 300,
      nativeWidth: 50,
      nativeHeight: 37,
      pixelSize: 8,
      algorithm: 'quantize',
      paletteSize: 24,
    });
    handler = new GeneratePixelArtHandler(processor, limits);
  });

  it('пикселизирует буфер с выбранным алгоритмом', async () => {
    const result = await handler.execute({
      buffer: pngMagic,
      pixelSize: 8,
      algorithm: 'bayer',
      paletteSize: 16,
    });

    expect(pixelate).toHaveBeenCalledWith(pngMagic, {
      pixelSize: 8,
      algorithm: 'bayer',
      paletteSize: 16,
    });
    expect(result.nativeWidth).toBe(50);
    expect(result.nativeBase64).toBe(Buffer.from('tiny').toString('base64'));
  });

  it('требует ровно один источник', async () => {
    await expect(handler.execute({})).rejects.toBeInstanceOf(ValidationError);
  });
});
