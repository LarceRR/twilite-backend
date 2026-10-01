import { describe, expect, it } from 'vitest';

import { parseManifestSafely } from './pixelObjectQueries';

describe('parseManifestSafely (P2-S3)', () => {
  it('returns null for corrupt rows instead of throwing', () => {
    expect(parseManifestSafely({ not: 'a manifest' }, 'id')).toBeNull();
  });

  it('accepts a minimal valid manifest shape when fields match schema', () => {
    const raw = {
      format: 'twilite.pixelobject/v1',
      canvas: { width: 16, height: 16 },
      sheet: {
        mediaId: '11111111-1111-4111-8111-111111111111',
        frameWidth: 16,
        frameHeight: 16,
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
    };
    expect(parseManifestSafely(raw, 'id')).toEqual(raw);
  });
});
