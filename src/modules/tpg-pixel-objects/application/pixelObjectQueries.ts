import { and, desc, eq, isNotNull, lt, ne, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjectRevisions, pixelObjects, users } from '@/database/schema';
import type {
  PixelObjectDto,
  PixelObjectManifest,
  PixelObjectType,
} from '@/shared/contracts/pixelObjects.contract';
import {
  pixelObjectManifestSchema,
  pixelObjectTypeSchema,
} from '@/shared/contracts/pixelObjects.contract';
import { ValidationError } from '@/shared/errors';

import type { CatalogCursor } from './catalogCursor';
import { authorFacingStatusSql } from './pixelObjectDeletion';
import { pixelObjectPreviewPath, pixelObjectSheetPath } from './pixelObjectSheetPath';

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

function requireObjectType(value: string): PixelObjectType {
  const parsed = pixelObjectTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError('Неизвестный тип объекта', [
      { path: 'objectType', message: 'Ожидается Good или Bad' },
    ]);
  }
  return parsed.data;
}

export function toPixelObjectDto(
  row: JoinedPixelObject,
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

  const sheetUrl = pixelObjectSheetPath(row.object.id, row.revisionNumber);

  const previewUrl =
    row.previewStorageKey !== null && row.previewStorageKey.length > 0
      ? pixelObjectPreviewPath(row.object.id, row.revisionNumber)
      : null;

  return {
    id: row.object.id,
    projectId: row.object.projectId,
    title: row.object.title,
    objectType: requireObjectType(row.object.objectType),
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
      status: authorFacingStatusSql<PixelObjectRow['status']>(rev.status, pixelObjects.status),
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
