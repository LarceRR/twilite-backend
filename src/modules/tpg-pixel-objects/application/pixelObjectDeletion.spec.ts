import 'reflect-metadata';

import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import {
  mediaAssets,
  pixelObjectRevisions,
  pixelObjects,
  surfaceObjects,
  tpgProjects,
} from '@/database/schema';
import {
  ADMIN_GROUP_PERMISSIONS,
  ARTIST_GROUP_PERMISSIONS,
  PERMISSION_CATALOG,
} from '@/modules/rbac/domain/catalog/permissionCatalog';
import type { PixelObjectRow } from '@/modules/tpg-pixel-objects/application/pixelObjectQueries';
import { RBAC_REQUIRE_ALL, RBAC_REQUIRE_ANY } from '@/shared/decorators/rbac.decorators';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { PixelObjectsController } from '../presentation/controllers/pixelObjects.controller';
import {
  authorFacingStatus,
  authorFacingStatusSql,
  authorHardDeletes,
  collectPixelObjectMediaIds,
  mediaIdsSafeToDelete,
  stripPixelObjectMetadata,
} from './pixelObjectDeletion';
import { PixelObjectsService } from './pixelObjects.service';

describe('authorHardDeletes', () => {
  it('erases pending and rejected drafts', () => {
    expect(authorHardDeletes({ publishedRevisionId: null, status: 'pending' })).toBe(true);
    expect(authorHardDeletes({ publishedRevisionId: null, status: 'rejected' })).toBe(true);
  });

  it('keeps an object that was published, including one with a newer pending revision', () => {
    expect(authorHardDeletes({ publishedRevisionId: 'rev', status: 'published' })).toBe(false);
    expect(authorHardDeletes({ publishedRevisionId: 'rev', status: 'pending' })).toBe(false);
    expect(authorHardDeletes({ publishedRevisionId: null, status: 'published' })).toBe(false);
  });
});

describe('authorFacingStatus', () => {
  it('does not let a published revision hide an archived head', () => {
    expect(authorFacingStatus('archived', 'published')).toBe('archived');
    expect(authorFacingStatus('published', 'pending')).toBe('pending');
    expect(authorFacingStatus('rejected', null)).toBe('rejected');
  });

  it('encodes the same rule in the author-list status SQL', () => {
    const fragment = authorFacingStatusSql(sql`rev_status`, sql`head_status`);
    const rendered = JSON.stringify(fragment, (_key, value: unknown) =>
      typeof value === 'object' && value !== null && 'queryChunks' in value
        ? (value as { queryChunks: unknown }).queryChunks
        : value,
    );
    expect(rendered).toContain('archived');
    expect(rendered).toContain('coalesce');
  });
});

describe('purge media selection', () => {
  it('collects sheet and preview ids and keeps media still used elsewhere', () => {
    expect(
      collectPixelObjectMediaIds('sheet-head', [
        { sheetMediaId: 'sheet-rev', previewMediaId: 'preview-1' },
        { sheetMediaId: 'sheet-head', previewMediaId: null },
      ]),
    ).toEqual(['sheet-head', 'sheet-rev', 'preview-1']);
    expect(mediaIdsSafeToDelete(['sheet-head', 'sheet-rev'], new Set(['sheet-rev']))).toEqual([
      'sheet-head',
    ]);
  });

  it('drops only the pixelObjectId key from surface metadata', () => {
    expect(stripPixelObjectMetadata({ pixelObjectId: 'obj-1', note: 'keep' }, 'obj-1')).toEqual({
      note: 'keep',
    });
  });
});

describe('pixel object delete permission', () => {
  it('gives permanent delete to admins only', () => {
    expect(PERMISSION_CATALOG.some((entry) => entry.name === 'tpg.pixelObjects.purge')).toBe(true);
    expect(ADMIN_GROUP_PERMISSIONS).toContain('tpg.pixelObjects.purge');
    expect(ARTIST_GROUP_PERMISSIONS).not.toContain('tpg.pixelObjects.purge');
    expect(Reflect.getMetadata(RBAC_REQUIRE_ALL, PixelObjectsController.prototype.purge)).toEqual([
      'tpg.pixelObjects.purge',
    ]);
    expect(Reflect.getMetadata(RBAC_REQUIRE_ANY, PixelObjectsController.prototype.remove)).toEqual([
      'tpg.pixelObjects.submit',
      'tpg.pixelObjects.create',
    ]);
  });
});

type Store = {
  objects: PixelObjectRow[];
  revisions: Array<{ sheetMediaId: string; previewMediaId: string | null }>;
  surfaces: Array<{ id: string; pixelObjectId: string | null; metadata: Record<string, unknown> }>;
  media: Array<{ id: string; storageKey: string }>;
};

function objectRow(overrides: Partial<PixelObjectRow> = {}): PixelObjectRow {
  return {
    id: 'obj-1',
    projectId: 'project-1',
    authorUserId: 'author-1',
    title: 'Sprite',
    objectType: 'Good',
    manifest: {},
    sheetMediaId: 'sheet-1',
    status: 'pending',
    rejectionComment: null,
    revision: 1,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedRevisionId: null,
    pendingRevisionId: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createDb(store: Store) {
  class Chain implements PromiseLike<unknown> {
    private table: unknown;
    private patch: Record<string, unknown> | undefined;

    constructor(
      private readonly op: 'select' | 'update' | 'delete',
      table?: unknown,
    ) {
      this.table = table;
    }

    from(table: unknown) {
      this.table = table;
      return this;
    }

    where() {
      return this;
    }

    limit() {
      return this;
    }

    for() {
      return this;
    }

    set(patch: Record<string, unknown>) {
      this.patch = patch;
      return this;
    }

    returning() {
      return this;
    }

    // biome-ignore lint/suspicious/noThenProperty: the fake query builder is awaited like Drizzle
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }

    private run(): unknown {
      if (this.op === 'select') {
        if (this.table === pixelObjects) {
          return store.objects.map((row) => ({ ...row }));
        }
        if (this.table === pixelObjectRevisions) {
          return store.revisions.map((row) => ({ ...row }));
        }
        if (this.table === surfaceObjects) {
          return store.surfaces.map((row) => ({ ...row }));
        }
        if (this.table === mediaAssets) {
          return store.media.map((row) => ({ ...row }));
        }
        if (this.table === tpgProjects) {
          return [];
        }
        return [];
      }
      if (this.op === 'update' && this.patch !== undefined) {
        if (this.table === pixelObjects) {
          store.objects = store.objects.map((row) => ({ ...row, ...this.patch }));
          return store.objects.map((row) => ({ id: row.id }));
        }
        if (this.table === surfaceObjects) {
          store.surfaces = store.surfaces.map((row) => ({ ...row, ...this.patch }));
        }
        return [];
      }
      if (this.op === 'delete') {
        if (this.table === pixelObjects) {
          store.objects = [];
          store.revisions = [];
        }
        if (this.table === mediaAssets) {
          store.media = [];
        }
      }
      return [];
    }
  }

  const db = {
    select: () => new Chain('select'),
    update: (table: unknown) => new Chain('update', table),
    delete: (table: unknown) => new Chain('delete', table),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return db;
}

function createService(
  store: Store,
  projects: Record<string, unknown>,
  storage: { delete: ReturnType<typeof vi.fn> },
) {
  return new PixelObjectsService(
    createDb(store) as never,
    storage as never,
    {} as never,
    projects as never,
    { error: vi.fn(), warn: vi.fn() } as never,
    { emit: vi.fn() } as never,
    {} as never,
    { write: vi.fn(async () => undefined) } as never,
    { getEffectivePermissions: vi.fn(async () => []) } as never,
  );
}

describe('PixelObjectsService.remove', () => {
  it('erases a pending draft and its sheet and preview from storage', async () => {
    const store: Store = {
      objects: [objectRow({ status: 'pending' })],
      revisions: [{ sheetMediaId: 'sheet-1', previewMediaId: 'preview-1' }],
      surfaces: [],
      media: [
        { id: 'sheet-1', storageKey: 'media/pixel-sheet/sheet-1' },
        { id: 'preview-1', storageKey: 'pixel-preview/preview-1.png' },
      ],
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createService(store, {}, storage);

    await expect(service.remove('author-1', 'obj-1')).resolves.toEqual({ outcome: 'deleted' });
    expect(store.objects).toEqual([]);
    expect(store.revisions).toEqual([]);
    expect(storage.delete).toHaveBeenCalledWith('media/pixel-sheet/sheet-1');
    expect(storage.delete).toHaveBeenCalledWith('pixel-preview/preview-1.png');
  });

  it('erases a rejected draft the same way', async () => {
    const store: Store = {
      objects: [objectRow({ status: 'rejected' })],
      revisions: [{ sheetMediaId: 'sheet-1', previewMediaId: null }],
      surfaces: [],
      media: [{ id: 'sheet-1', storageKey: 'media/pixel-sheet/sheet-1' }],
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createService(store, {}, storage);

    await expect(service.remove('author-1', 'obj-1')).resolves.toEqual({ outcome: 'deleted' });
    expect(store.objects).toEqual([]);
    expect(storage.delete).toHaveBeenCalledWith('media/pixel-sheet/sheet-1');
  });

  it('reassigns a published object to Twilite without touching storage or the pending revision', async () => {
    const store: Store = {
      objects: [
        objectRow({
          status: 'published',
          publishedRevisionId: 'rev-published',
          pendingRevisionId: 'rev-pending',
        }),
      ],
      revisions: [],
      surfaces: [],
      media: [],
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createService(
      store,
      {
        requireTwiliteSystemUserId: async () => 'twilite-1',
        ensureReassignmentInbox: async () => ({ id: 'inbox-1' }),
      },
      storage,
    );

    await expect(service.remove('author-1', 'obj-1')).resolves.toEqual({ outcome: 'reassigned' });
    expect(store.objects[0]).toMatchObject({
      authorUserId: 'twilite-1',
      projectId: 'inbox-1',
      status: 'published',
      publishedRevisionId: 'rev-published',
      pendingRevisionId: 'rev-pending',
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('refuses to reassign an object Twilite already owns', async () => {
    const store: Store = {
      objects: [
        objectRow({
          authorUserId: 'twilite-1',
          status: 'published',
          publishedRevisionId: 'rev-published',
        }),
      ],
      revisions: [],
      surfaces: [],
      media: [],
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createService(
      store,
      { requireTwiliteSystemUserId: async () => 'twilite-1' },
      storage,
    );

    await expect(service.remove('twilite-1', 'obj-1')).rejects.toBeInstanceOf(ConflictError);
    expect(store.objects[0]?.projectId).toBe('project-1');
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe('PixelObjectsService.purge', () => {
  it('erases a published object, clears the surface binding, and deletes storage keys', async () => {
    const store: Store = {
      objects: [
        objectRow({
          status: 'published',
          publishedRevisionId: 'rev-published',
        }),
      ],
      revisions: [{ sheetMediaId: 'sheet-1', previewMediaId: 'preview-1' }],
      surfaces: [
        {
          id: 'placement-1',
          pixelObjectId: 'obj-1',
          metadata: { pixelObjectId: 'obj-1', note: 'keep' },
        },
      ],
      media: [
        { id: 'sheet-1', storageKey: 'media/pixel-sheet/sheet-1' },
        { id: 'preview-1', storageKey: 'pixel-preview/preview-1.png' },
      ],
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createService(store, {}, storage);

    await expect(service.purge('admin-1', 'obj-1')).resolves.toBeUndefined();
    expect(store.objects).toEqual([]);
    expect(store.surfaces[0]).toMatchObject({
      pixelObjectId: null,
      metadata: { note: 'keep' },
    });
    expect(storage.delete).toHaveBeenCalledWith('media/pixel-sheet/sheet-1');
    expect(storage.delete).toHaveBeenCalledWith('pixel-preview/preview-1.png');
  });

  it('returns not found when the object is already gone', async () => {
    const store: Store = { objects: [], revisions: [], surfaces: [], media: [] };
    const service = createService(store, {}, { delete: vi.fn() });
    await expect(service.purge('admin-1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
