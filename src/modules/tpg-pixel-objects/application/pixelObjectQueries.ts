import { and, desc, eq, isNotNull, lt, ne, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjectRevisions, pixelObjects, users } from '@/database/schema';
import type { StoragePort } from '@/infrastructure/storage/StoragePort';
import type { PixelObjectDto, PixelObjectManifest } from '@/shared/contracts/pixelObjects.contract';
import { pixelObjectManifestSchema } from '@/shared/contracts/pixelObjects.contract';
import { InfrastructureError, ValidationError } from '@/shared/errors';

import type { CatalogCursor } from './catalogCursor';

export type PixelObjectRow = typeof pixelObjects.$inferSelect;

const sheetMedia = alias(mediaAssets, 'sheet_media');
const previewMedia = alias(mediaAssets, 'preview_media');

export type JoinedPixelObject = {
  readonly object: PixelObjectRow;
  readonly authorDisplayName: string;
  readonly storageKey: string;
  readonly previewStorageKey: string | null;
  readonly revisionNumber: number;
  readonly manifest: unknown;
  readonly rejectionComment: string | null;
  /**
   * Drizzle column selects yield `Date`; raw `sql` coalesce (author views) may
   * yield an ISO string from postgres-js.
   */
  readonly reviewedAt: Date | string | null;
  readonly status: PixelObjectRow['status'];
  /** Sort key for cursor pagination (publishedAt or updatedAt). */
  readonly sortAt: Date | null;
};

export function parseManifestSafely(raw: unknown, objectId: string): PixelObjectManifest | null {
  const parsed = pixelObjectManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  void objectId;
  return parsed.data;
}

/** Normalize driver Date / ISO string timestamps to ISO-8601 (or null). */
export function toIsoStringOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function toPixelObjectDto(
  row: JoinedPixelObject,
  storage: StoragePort,
  options: { readonly quarantineCorrupt?: boolean } = {},
): PixelObjectDto | null {
  const manifest = parseManifestSafely(row.manifest, row.object.id);
  if (manifest === null) {
    if (options.quarantineCorrupt) {
      return null;
    }
    throw new ValidationError('Повреждённый manifest объекта', [
      { path: 'manifest', message: 'Не проходит схему TPO v1' },
    ]);
  }

  const sheetUrl = storage.publicUrl(row.storageKey);
  if (sheetUrl === null || sheetUrl.length === 0) {
    throw new InfrastructureError('Публичный URL spritesheet недоступен');
  }

  const previewUrl =
    row.previewStorageKey !== null && row.previewStorageKey.length > 0
      ? storage.publicUrl(row.previewStorageKey)
      : null;

  return {
    id: row.object.id,
    projectId: row.object.projectId,
    title: row.object.title,
    authorDisplayName: row.authorDisplayName,
    authorUserId: row.object.authorUserId,
    status: row.status,
    rejectionComment: row.rejectionComment,
    revision: row.revisionNumber,
    manifest,
    sheetUrl,
    previewUrl,
    createdAt: row.object.createdAt.toISOString(),
    updatedAt: row.object.updatedAt.toISOString(),
    reviewedAt: toIsoStringOrNull(row.reviewedAt),
  };
}

export function publishedCursorWhere(cursor: CatalogCursor): SQL {
  const published = pixelObjectRevisions;
  const at = new Date(cursor.publishedAt);
  const clause = or(
    lt(published.publishedAt, at),
    and(eq(published.publishedAt, at), lt(pixelObjects.id, cursor.id)),
  );
  if (clause === undefined) {
    throw new Error('publishedCursorWhere: empty SQL expression');
  }
  return clause;
}

export function authorCursorWhere(cursor: CatalogCursor): SQL {
  const at = new Date(cursor.publishedAt);
  const clause = or(
    lt(pixelObjects.updatedAt, at),
    and(eq(pixelObjects.updatedAt, at), lt(pixelObjects.id, cursor.id)),
  );
  if (clause === undefined) {
    throw new Error('authorCursorWhere: empty SQL expression');
  }
  return clause;
}

/** Catalog / mobile: resolve via published revision pointer. */
export async function selectPublishedJoined(
  db: Database,
  where: SQL | undefined,
  limit?: number,
): Promise<JoinedPixelObject[]> {
  const published = pixelObjectRevisions;
  const clauses = [
    isNotNull(pixelObjects.publishedRevisionId),
    ne(pixelObjects.status, 'archived'),
    ...(where === undefined ? [] : [where]),
  ];
  const query = db
    .select({
      object: pixelObjects,
      authorDisplayName: users.displayName,
      storageKey: sheetMedia.storageKey,
      previewStorageKey: previewMedia.storageKey,
      revisionNumber: published.revisionNumber,
      manifest: published.manifest,
      rejectionComment: published.rejectionComment,
      reviewedAt: published.reviewedAt,
      status: published.status,
      sortAt: published.publishedAt,
    })
    .from(pixelObjects)
    .innerJoin(users, eq(users.id, pixelObjects.authorUserId))
    .innerJoin(published, eq(published.id, pixelObjects.publishedRevisionId))
    .innerJoin(sheetMedia, eq(sheetMedia.id, published.sheetMediaId))
    .leftJoin(previewMedia, eq(previewMedia.id, published.previewMediaId))
    .where(and(...clauses))
    .orderBy(desc(published.publishedAt), desc(pixelObjects.id));

  return limit === undefined ? query : query.limit(limit);
}

/** Author/moderation views: prefer pending revision when present. */
export async function selectAuthorJoined(
  db: Database,
  where: SQL | undefined,
  limit?: number,
): Promise<JoinedPixelObject[]> {
  const rev = pixelObjectRevisions;
  const query = db
    .select({
      object: pixelObjects,
      authorDisplayName: users.displayName,
      storageKey: sheetMedia.storageKey,
      previewStorageKey: previewMedia.storageKey,
      revisionNumber: sql<number>`coalesce(${rev.revisionNumber}, ${pixelObjects.revision})`,
      manifest: sql<unknown>`coalesce(${rev.manifest}, ${pixelObjects.manifest})`,
      rejectionComment: sql<
        string | null
      >`coalesce(${rev.rejectionComment}, ${pixelObjects.rejectionComment})`,
      reviewedAt: sql<
        Date | string | null
      >`coalesce(${rev.reviewedAt}, ${pixelObjects.reviewedAt})`,
      status: sql<PixelObjectRow['status']>`coalesce(${rev.status}, ${pixelObjects.status})`,
      sortAt: pixelObjects.updatedAt,
    })
    .from(pixelObjects)
    .innerJoin(users, eq(users.id, pixelObjects.authorUserId))
    .leftJoin(
      rev,
      eq(
        rev.id,
        sql`coalesce(${pixelObjects.pendingRevisionId}, ${pixelObjects.publishedRevisionId})`,
      ),
    )
    .innerJoin(
      sheetMedia,
      eq(sheetMedia.id, sql`coalesce(${rev.sheetMediaId}, ${pixelObjects.sheetMediaId})`),
    )
    .leftJoin(previewMedia, eq(previewMedia.id, rev.previewMediaId))
    .where(where)
    .orderBy(desc(pixelObjects.updatedAt), desc(pixelObjects.id));

  return limit === undefined ? query : query.limit(limit);
}
