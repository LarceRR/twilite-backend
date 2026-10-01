import { describe, expect, it } from 'vitest';

import {
  CONTRACT_ERROR_CODES,
  DEFAULT_PIXEL_OBJECT_LIMITS,
  PIXEL_OBJECT_FORMAT,
  pixelObjectLimitsSchema,
  pixelObjectManifestSchema,
  pixelObjectMobileSchema,
} from '../src/index';

const validManifest = {
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
      id: 'default' as const,
      loop: true as const,
      frames: [{ frame: 0, durationMs: 100 }],
    },
  ],
  staticPreviewFrame: 0,
};

describe('@twilite/contracts package', () => {
  it('accepts a canonical one-frame TPO manifest', () => {
    expect(pixelObjectManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it('rejects duplicate frame indices with invalid manifest semantics', () => {
    const result = pixelObjectManifestSchema.safeParse({
      ...validManifest,
      sheet: { ...validManifest.sheet, columns: 2, rows: 1, frameCount: 2 },
      animations: [
        {
          id: 'default',
          loop: true,
          frames: [
            { frame: 0, durationMs: 100 },
            { frame: 0, durationMs: 100 },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('parses mobile DTO without mediaId', () => {
    const result = pixelObjectMobileSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Torch',
      format: PIXEL_OBJECT_FORMAT,
      sheetUrl: 'https://cdn.example/sheet.png',
      canvas: validManifest.canvas,
      sheet: {
        frameWidth: 2,
        frameHeight: 2,
        columns: 1,
        rows: 1,
        frameCount: 1,
      },
      animations: validManifest.animations,
      staticPreviewFrame: 0,
    });
    expect(result.success).toBe(true);
  });

  it('exposes stable contract error codes and default limits', () => {
    expect(CONTRACT_ERROR_CODES).toContain('MEDIA_OBJECT_MISSING');
    expect(pixelObjectLimitsSchema.parse(DEFAULT_PIXEL_OBJECT_LIMITS).canvasMax).toBe(160);
  });
});
