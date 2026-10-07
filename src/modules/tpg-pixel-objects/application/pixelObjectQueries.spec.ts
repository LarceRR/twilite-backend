import { describe, expect, it } from 'vitest';

import {
  type JoinedPixelObject,
  parseManifestSafely,
  toIsoStringOrNull,
  toPixelObjectDto,
} from './pixelObjectQueries';

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

describe('toIsoStringOrNull', () => {
  it('handles Date, ISO string, and null', () => {
    const at = new Date('2024-06-01T12:00:00.000Z');
    expect(toIsoStringOrNull(at)).toBe('2024-06-01T12:00:00.000Z');
    expect(toIsoStringOrNull('2024-06-01T12:00:00.000Z')).toBe('2024-06-01T12:00:00.000Z');
    expect(toIsoStringOrNull(null)).toBeNull();
  });
});

describe('toPixelObjectDto', () => {
  const manifest = {
    format: 'twilite.pixelobject/v1' as const,
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

  const baseRow = {
    object: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      projectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      authorUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Test',
      objectType: 'Good',
      manifest,
      sheetMediaId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'published' as const,
      rejectionComment: null,
      revision: 1,
      reviewedByUserId: null,
      reviewedAt: null,
      publishedRevisionId: null,
      pendingRevisionId: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
    authorDisplayName: 'Author',
    storageKey: 'sheets/test.png',
    previewStorageKey: 'pixel-preview/test.png',
    revisionNumber: 1,
    manifest,
    rejectionComment: null,
    status: 'published' as const,
    sortAt: new Date('2024-01-02T00:00:00.000Z'),
  } satisfies Omit<JoinedPixelObject, 'reviewedAt'>;

  it('accepts reviewedAt as an ISO string from sql coalesce', () => {
    const dto = toPixelObjectDto({ ...baseRow, reviewedAt: '2024-06-01T12:00:00.000Z' });
    expect(dto?.reviewedAt).toBe('2024-06-01T12:00:00.000Z');
    expect(dto?.objectType).toBe('Good');
    expect(dto?.sheetUrl).toBe(
      '/v1/tpg/pixel-objects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revisions/1/sheet',
    );
    expect(dto?.previewUrl).toBe(
      '/v1/tpg/pixel-objects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revisions/1/preview',
    );
  });
});
