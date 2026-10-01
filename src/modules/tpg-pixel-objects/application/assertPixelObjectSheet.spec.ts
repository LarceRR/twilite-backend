import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  PIXEL_OBJECT_FORMAT,
  type PixelObjectManifest,
  pixelObjectMobileSchema,
} from '@/shared/contracts/pixelObjects.contract';
import { ValidationError } from '@/shared/errors';

import { assertPixelObjectSheet, collectManifestViolations } from './assertPixelObjectSheet';
import { toPixelObjectMobileDto } from './toPixelObjectMobileDto';

const LIMITS = { maxFrames: 64, maxBytes: 8 * 1024 * 1024 };

function manifest(overrides?: Partial<PixelObjectManifest>): PixelObjectManifest {
  return {
    format: PIXEL_OBJECT_FORMAT,
    canvas: { width: 2, height: 2 },
    sheet: {
      mediaId: '11111111-1111-4111-8111-111111111111',
      frameWidth: 2,
      frameHeight: 2,
      columns: 1,
      rows: 1,
      frameCount: 1,
    },
    animations: [
      {
        id: 'default',
        loop: true,
        frames: [{ frame: 0, durationMs: 100 }],
      },
    ],
    staticPreviewFrame: 0,
    ...overrides,
  };
}

async function png(width: number, height: number, rgba: Buffer): Promise<Buffer> {
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

describe('pixel object sheet validation', () => {
  it('accepts a one-frame sheet whose geometry matches the manifest', async () => {
    const rgba = Buffer.from([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(
      assertPixelObjectSheet(await png(2, 2, rgba), manifest(), LIMITS),
    ).resolves.toBeUndefined();
  });

  it('rejects a sheet whose pixel size does not match the manifest', async () => {
    const rgba = Buffer.from([255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const body = manifest();
    body.sheet = { ...body.sheet, columns: 2, frameWidth: 2, frameCount: 1 };
    await expect(
      assertPixelObjectSheet(await png(2, 2, rgba), body, LIMITS),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a fully transparent sheet', async () => {
    const rgba = Buffer.alloc(2 * 2 * 4, 0);
    await expect(
      assertPixelObjectSheet(await png(2, 2, rgba), manifest(), LIMITS),
    ).rejects.toMatchObject({
      message: 'В пакете нет видимых пикселей',
    });
  });

  it('rejects a manifest that skips a frame index', () => {
    const body = manifest();
    body.sheet = { ...body.sheet, columns: 2, rows: 1, frameCount: 2 };
    body.animations = [
      {
        id: 'default',
        loop: true,
        frames: [
          { frame: 0, durationMs: 100 },
          { frame: 0, durationMs: 100 },
        ],
      },
    ];
    expect(collectManifestViolations(body, 64).length).toBeGreaterThan(0);
  });
});

describe('mobile DTO', () => {
  const dto = toPixelObjectMobileDto({
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Spark',
    sheetUrl: 'https://cdn.example/sheet.png',
    manifest: manifest(),
  });

  it('matches the published mobile contract', () => {
    expect(pixelObjectMobileSchema.parse(dto)).toEqual(dto);
    expect(dto.format).toBe('twilite.pixelobject/v1');
    expect(dto.animations[0]?.loop).toBe(true);
    expect(dto.sheet.frameCount).toBe(1);
  });

  it('refuses an unknown major format', () => {
    expect(
      pixelObjectMobileSchema.safeParse({ ...dto, format: 'twilite.pixelobject/v2' }).success,
    ).toBe(false);
  });
});
