import { describe, expect, it } from 'vitest';
import type { PixelObjectManifest } from '@/shared/contracts/pixelObjects.contract';
import { decodeCatalogCursor } from './catalogCursor';
import {
  catalogAvatarUrl,
  catalogPageFromSources,
  fillPreviewAvatar,
  spriteFromManifest,
  toCatalogMoment,
  toCatalogMomentSource,
  toCatalogProjectSource,
  toNonNegativeInt,
} from './catalogProjectMapper';
import { likeContainsPattern, readCatalogCursor } from './catalogProjectsQuery';

const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWNER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function manifest(frameCount: number): PixelObjectManifest {
  return {
    format: 'twilite.pixelobject/v1',
    canvas: { width: 16, height: 16 },
    sheet: {
      mediaId: MEDIA_ID,
      frameWidth: 16,
      frameHeight: 16,
      columns: frameCount,
      rows: 1,
      frameCount,
    },
    animations: [
      {
        id: 'default',
        loop: true,
        frames: Array.from({ length: frameCount }, (_, frame) => ({ frame, durationMs: 80 })),
      },
    ],
    staticPreviewFrame: 0,
  };
}

describe('likeContainsPattern', () => {
  it('escapes wildcards and wraps the term', () => {
    expect(likeContainsPattern('100%_ok\\')).toBe('%100\\%\\_ok\\\\%');
  });

  it('treats blank input as no search', () => {
    expect(likeContainsPattern(undefined)).toBeNull();
    expect(likeContainsPattern('   ')).toBeNull();
  });
});

describe('readCatalogCursor', () => {
  it('accepts a cursor produced by the catalog encoder', () => {
    const raw = Buffer.from(`2026-10-01T12:00:00.000Z:${PROJECT_ID}`, 'utf8').toString('base64url');
    expect(readCatalogCursor(raw)).toEqual({
      publishedAt: '2026-10-01T12:00:00.000Z',
      id: PROJECT_ID,
    });
  });

  it('rejects a cursor whose id is not a uuid', () => {
    const raw = Buffer.from('2026-10-01T12:00:00.000Z:not-a-uuid', 'utf8').toString('base64url');
    expect(() => readCatalogCursor(raw)).toThrow(/cursor/);
  });
});

describe('catalog project mapping', () => {
  it('drops storage keys and keeps only an API avatar path', () => {
    const source = toCatalogProjectSource({
      projectId: PROJECT_ID,
      title: '  Lights  ',
      authorDisplayName: 'Twilite',
      official: true,
      ownerId: null,
      userAvatarKey: null,
      avatarStorageKey: 'secret/object-key',
      objectCount: '3',
      byteSize: '2048',
      latestAt: new Date('2026-10-01T12:00:00.000Z'),
    });

    expect(source).toMatchObject({
      id: PROJECT_ID,
      title: 'Lights',
      official: true,
      avatarUrl: `/v1/tpg/projects/${PROJECT_ID}/avatar`,
      objectCount: 3,
      byteSize: 2048,
    });
    expect(JSON.stringify(source)).not.toContain('secret/object-key');
  });

  it('uses the owner photo and drops both storage keys', () => {
    const source = toCatalogProjectSource({
      projectId: PROJECT_ID,
      title: 'Lights',
      authorDisplayName: 'Maku',
      official: false,
      ownerId: OWNER_ID,
      userAvatarKey: 'users/secret-avatar',
      avatarStorageKey: 'projects/secret-avatar',
      objectCount: 1,
      byteSize: 1,
      latestAt: new Date('2026-10-01T12:00:00.000Z'),
    });

    expect(source?.avatarUrl).toBe(`/v1/users/${OWNER_ID}/avatar`);
    expect(JSON.stringify(source)).not.toContain('secret');
  });

  it('keeps a preview-backed project image when the owner has no photo', () => {
    const source = toCatalogProjectSource({
      projectId: PROJECT_ID,
      title: 'Lights',
      authorDisplayName: 'Maku',
      official: false,
      ownerId: OWNER_ID,
      userAvatarKey: null,
      avatarStorageKey: null,
      objectCount: 1,
      byteSize: 0,
      latestAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    if (source === null) throw new Error('expected a project source');

    expect(fillPreviewAvatar(source, true).avatarUrl).toBe(`/v1/tpg/projects/${PROJECT_ID}/avatar`);
    expect(
      catalogAvatarUrl({
        projectId: PROJECT_ID,
        ownerId: OWNER_ID,
        userAvatarKey: '',
        projectAvatarKey: null,
        hasPreview: false,
      }),
    ).toBeNull();
  });

  it('rejects a project row without a usable timestamp', () => {
    expect(
      toCatalogProjectSource({
        projectId: PROJECT_ID,
        title: 'Lights',
        authorDisplayName: 'Twilite',
        official: false,
        ownerId: null,
        userAvatarKey: null,
        avatarStorageKey: null,
        objectCount: 1,
        byteSize: 1,
        latestAt: 'not-a-date',
      }),
    ).toBeNull();
  });
});

describe('catalog moment mapping', () => {
  it('keeps the sheet path and never the media id', () => {
    const source = toCatalogMomentSource({
      projectId: PROJECT_ID,
      id: OBJECT_ID,
      title: 'Camping',
      revisionNumber: 2,
      manifest: manifest(4),
      previewKey: 'preview-key',
      rank: '1',
    });
    if (source === null) throw new Error('expected a moment source');

    const moment = toCatalogMoment(source);
    expect(moment?.previewUrl).toBe(`/v1/tpg/pixel-objects/${OBJECT_ID}/revisions/2/preview`);
    expect(moment?.sprite?.sheetUrl).toBe(`/v1/tpg/pixel-objects/${OBJECT_ID}/revisions/2/sheet`);
    expect(moment?.sprite?.frames).toHaveLength(4);
    expect(JSON.stringify(moment)).not.toContain(MEDIA_ID);
    expect(JSON.stringify(moment)).not.toContain('preview-key');
  });

  it('drops a corrupt manifest', () => {
    const source = toCatalogMomentSource({
      projectId: PROJECT_ID,
      id: OBJECT_ID,
      title: 'Broken',
      revisionNumber: 1,
      manifest: { format: 'nope' },
      previewKey: null,
      rank: 1,
    });
    if (source === null) throw new Error('expected a moment source');
    expect(toCatalogMoment(source)).toBeNull();
  });

  it('builds a one-frame sprite without copying mediaId', () => {
    const sprite = spriteFromManifest(OBJECT_ID, 1, manifest(1));
    expect(sprite?.frameCount).toBe(1);
    expect(JSON.stringify(sprite)).not.toContain(MEDIA_ID);
  });
});

describe('catalogPageFromSources', () => {
  it('returns one extra row as a cursor and caps moments per project', () => {
    const projects = [0, 1].map((index) => ({
      id: index === 0 ? PROJECT_ID : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      title: `Pack ${index}`,
      authorDisplayName: 'Author',
      official: false,
      avatarUrl: null,
      objectCount: 2,
      byteSize: 100,
      latestAt: `2026-10-0${index + 1}T00:00:00.000Z`,
    }));
    const moments = [5, 2, 4, 1, 3].map((rank) => ({
      projectId: PROJECT_ID,
      id: `dddddddd-dddd-4ddd-8ddd-ddddddddddd${rank}`,
      title: `Moment ${rank}`,
      revisionNumber: 1,
      manifest: manifest(2),
      hasPreview: false,
      rank,
    }));

    const page = catalogPageFromSources(projects, moments, 1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.moments.map((moment) => moment.title)).toEqual([
      'Moment 1',
      'Moment 2',
      'Moment 3',
      'Moment 4',
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(decodeCatalogCursor(page.nextCursor ?? '')?.id).toBe(PROJECT_ID);
  });

  it('coerces unsafe counts to zero', () => {
    expect(toNonNegativeInt('-1')).toBe(0);
    expect(toNonNegativeInt('12')).toBe(12);
    expect(toNonNegativeInt(4n)).toBe(4);
  });
});
