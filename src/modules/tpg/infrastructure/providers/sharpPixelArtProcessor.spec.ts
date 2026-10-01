import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { MAX_EDGE } from '../../domain/constants';
import { SharpPixelArtProcessor } from './sharpPixelArtProcessor';

async function makeLandscape(): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 300,
            height: 300,
            channels: 3,
            background: { r: 220, g: 60, b: 40 },
          },
        })
          .png()
          .toBuffer(),
        top: 150,
        left: 250,
      },
    ])
    .png()
    .toBuffer();
}

async function uniqueColors(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const set = new Set<string>();
  for (let i = 0; i < data.length; i += info.channels) {
    set.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  return set.size;
}

describe('SharpPixelArtProcessor', () => {
  const processor = new SharpPixelArtProcessor();

  it('вписывает в MAX_EDGE и сохраняет пропорции', async () => {
    const result = await processor.pixelate(await makeLandscape(), {
      pixelSize: 8,
      algorithm: 'nearest',
    });

    expect(result.width).toBe(MAX_EDGE);
    expect(result.height).toBe(300);
    expect(result.nativeWidth).toBe(50);
    expect(result.nativeHeight).toBe(37);
    expect(result.algorithm).toBe('nearest');
    expect(result.nativeBuffer.byteLength).toBeGreaterThan(0);
  });

  it('quantize ограничивает палитру', async () => {
    const source = await makeLandscape();
    const quantized = await processor.pixelate(source, {
      pixelSize: 8,
      algorithm: 'quantize',
      paletteSize: 16,
    });

    expect(quantized.algorithm).toBe('quantize');
    expect(await uniqueColors(quantized.buffer)).toBeLessThanOrEqual(16);
  });

  it('сохраняет прозрачный фон', async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 80,
              height: 80,
              channels: 4,
              background: { r: 255, g: 80, b: 40, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          top: 60,
          left: 60,
        },
      ])
      .png()
      .toBuffer();

    const result = await processor.pixelate(source, {
      pixelSize: 10,
      algorithm: 'quantize',
    });

    const { data, info } = await sharp(result.buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.channels).toBe(4);
    // Corner should stay fully transparent.
    expect(data[3]).toBe(0);
  });

  it('разные алгоритмы дают разный результат', async () => {
    const source = await makeLandscape();
    const quantize = await processor.pixelate(source, { pixelSize: 10, algorithm: 'quantize' });
    const bayer = await processor.pixelate(source, { pixelSize: 10, algorithm: 'bayer' });
    const floyd = await processor.pixelate(source, {
      pixelSize: 10,
      algorithm: 'floyd-steinberg',
    });

    expect(Buffer.compare(quantize.buffer, bayer.buffer)).not.toBe(0);
    expect(Buffer.compare(bayer.buffer, floyd.buffer)).not.toBe(0);
  });
});
