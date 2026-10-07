import { and, desc, eq, inArray, isNotNull, ne, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from '@/database/drizzle/drizzle.module';
import {
  mediaAssets,
  pixelObjectRevisions,
  pixelObjects,
  tpgProjects,
  users,
} from '@/database/schema';
import { TWILITE_SYSTEM_USER_EMAIL } from '@/shared/constants/twiliteSystemUser';
import type { PixelObjectType } from '@/shared/contracts/pixelObjects.contract';

import type { CatalogCursor } from './catalogCursor';
import {
  type CatalogMomentSource,
  type CatalogProjectSource,
  fillPreviewAvatar,
  toCatalogMomentSource,
  toCatalogProjectSource,
  toNonNegativeInt,
} from './catalogProjectMapper';
import { CATALOG_MOMENTS_PER_PROJECT, type CatalogProjectsQuery } from './catalogProjectsQuery';

const sheetBytes = alias(mediaAssets, 'catalog_sheet_bytes');
const previewMedia = alias(mediaAssets, 'catalog_preview_media');
const avatarMedia = alias(mediaAssets, 'catalog_project_avatar');
const titleMatch = alias(pixelObjects, 'catalog_title_match');

export async function selectCatalogProjects(
  db: Database,
  query: CatalogProjectsQuery,
  pattern: string | null,
  cursor: CatalogCursor | null,
): Promise<readonly CatalogProjectSource[]> {
  const totals = projectTotals(db, query.objectType);
  const rows = await db
    .select({
      projectId: totals.projectId,
      title: tpgProjects.title,
      authorDisplayName: users.displayName,
      official: sql<boolean>`lower(${users.email}) = lower(${TWILITE_SYSTEM_USER_EMAIL})`,
      ownerId: users.id,
      userAvatarKey: users.avatarStorageKey,
      avatarStorageKey: avatarMedia.storageKey,
      objectCount: totals.objectCount,
      byteSize: sql<number>`0`,
      latestAt: totals.latestAt,
    })
    .from(totals)
    .innerJoin(tpgProjects, eq(tpgProjects.id, totals.projectId))
    .innerJoin(users, eq(users.id, tpgProjects.ownerId))
    .leftJoin(avatarMedia, eq(avatarMedia.id, tpgProjects.avatarMediaId))
    .where(pageWhere(totals.latestAt, totals.projectId, query.objectType, pattern, cursor))
    .orderBy(desc(totals.latestAt), desc(totals.projectId))
    .limit(query.limit + 1);

  const sources = rows.flatMap((row) => {
    const source = toCatalogProjectSource(row);
    return source === null ? [] : [source];
  });
  const stats = await selectPageStats(
    db,
    sources.map((source) => source.id),
    query.objectType,
  );
  return sources.map((source) => withPageStat(source, stats.get(source.id)));
}

export async function selectCatalogMoments(
  db: Database,
  projectIds: readonly string[],
  objectType: PixelObjectType,
  pattern: string | null,
): Promise<readonly CatalogMomentSource[]> {
  if (projectIds.length === 0) return [];
  const ranked = rankedMoments(db, projectIds, objectType, pattern);
  const rows = await db
    .select()
    .from(ranked)
    .where(sql`${ranked.momentRank} <= ${CATALOG_MOMENTS_PER_PROJECT}`);
  return rows.flatMap((row) => {
    const source = toCatalogMomentSource({ ...row, rank: row.momentRank });
    return source === null ? [] : [source];
  });
}

function projectTotals(db: Database, objectType: PixelObjectType) {
  return db
    .select({
      projectId: pixelObjects.projectId,
      objectCount: sql<number>`count(*)::int`.as('object_count'),
      latestAt: sql<Date>`max(${pixelObjectRevisions.publishedAt})`.as('latest_at'),
    })
    .from(pixelObjects)
    .innerJoin(pixelObjectRevisions, eq(pixelObjectRevisions.id, pixelObjects.publishedRevisionId))
    .where(publishedFilter(objectType))
    .groupBy(pixelObjects.projectId)
    .as('catalog_project_totals');
}

type PageStat = { readonly byteSize: number; readonly hasPreview: boolean };

/** Sheet bytes and preview presence are read only for the page. */
async function selectPageStats(
  db: Database,
  projectIds: readonly string[],
  objectType: PixelObjectType,
): Promise<ReadonlyMap<string, PageStat>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db
    .select({
      projectId: pixelObjects.projectId,
      byteSize: sql<string>`coalesce(sum(${sheetBytes.byteSize}), 0)::bigint`,
      hasPreview: sql<boolean>`bool_or(${previewMedia.storageKey} is not null)`,
    })
    .from(pixelObjects)
    .innerJoin(pixelObjectRevisions, eq(pixelObjectRevisions.id, pixelObjects.publishedRevisionId))
    .innerJoin(sheetBytes, eq(sheetBytes.id, pixelObjectRevisions.sheetMediaId))
    .leftJoin(previewMedia, eq(previewMedia.id, pixelObjectRevisions.previewMediaId))
    .where(and(inArray(pixelObjects.projectId, [...projectIds]), publishedFilter(objectType)))
    .groupBy(pixelObjects.projectId);
  return new Map(rows.map((row) => [row.projectId, pageStat(row.byteSize, row.hasPreview)]));
}

function pageStat(byteSize: unknown, hasPreview: unknown): PageStat {
  return {
    byteSize: toNonNegativeInt(byteSize),
    hasPreview: hasPreview === true || hasPreview === 't' || hasPreview === 'true',
  };
}

function withPageStat(
  source: CatalogProjectSource,
  stat: PageStat | undefined,
): CatalogProjectSource {
  const filled = fillPreviewAvatar(source, stat?.hasPreview === true);
  return { ...filled, byteSize: stat?.byteSize ?? 0 };
}

function rankedMoments(
  db: Database,
  projectIds: readonly string[],
  objectType: PixelObjectType,
  pattern: string | null,
) {
  return db
    .select({
      projectId: pixelObjects.projectId,
      id: pixelObjects.id,
      title: pixelObjects.title,
      revisionNumber: pixelObjectRevisions.revisionNumber,
      manifest: pixelObjectRevisions.manifest,
      previewKey: previewMedia.storageKey,
      momentRank: momentRank(pattern).as('moment_rank'),
    })
    .from(pixelObjects)
    .innerJoin(pixelObjectRevisions, eq(pixelObjectRevisions.id, pixelObjects.publishedRevisionId))
    .leftJoin(previewMedia, eq(previewMedia.id, pixelObjectRevisions.previewMediaId))
    .where(and(inArray(pixelObjects.projectId, [...projectIds]), publishedFilter(objectType)))
    .as('catalog_moment_rank');
}

function publishedFilter(objectType: PixelObjectType) {
  return and(
    isNotNull(pixelObjects.publishedRevisionId),
    ne(pixelObjects.status, 'archived'),
    eq(pixelObjects.objectType, objectType),
    isNotNull(pixelObjectRevisions.publishedAt),
  );
}

function momentRank(pattern: string | null) {
  const preference =
    pattern === null
      ? sql`0`
      : sql`case when ${pixelObjects.title} ilike ${pattern} escape '\\' then 0 else 1 end`;
  return sql<number>`row_number() over (
    partition by ${pixelObjects.projectId}
    order by ${preference}, ${pixelObjectRevisions.publishedAt} desc, ${pixelObjects.id} desc
  )`;
}

function pageWhere(
  latestAt: unknown,
  projectId: unknown,
  objectType: PixelObjectType,
  pattern: string | null,
  cursor: CatalogCursor | null,
): SQL {
  const clauses: SQL[] = [];
  if (cursor !== null) clauses.push(olderThan(latestAt, projectId, cursor));
  if (pattern !== null) clauses.push(titleSearch(pattern, objectType));
  if (clauses.length === 0) return sql`true`;
  return and(...clauses) ?? sql`true`;
}

function olderThan(latestAt: unknown, projectId: unknown, cursor: CatalogCursor): SQL {
  const at = new Date(cursor.publishedAt);
  return sql`(${latestAt} < ${at} or (${latestAt} = ${at} and ${projectId} < ${cursor.id}))`;
}

function titleSearch(pattern: string, objectType: PixelObjectType): SQL {
  return sql`(
    ${tpgProjects.title} ilike ${pattern} escape '\\'
    or ${users.displayName} ilike ${pattern} escape '\\'
    or exists (
      select 1 from ${titleMatch}
      where ${titleMatch.projectId} = ${tpgProjects.id}
        and ${titleMatch.objectType} = ${objectType}
        and ${titleMatch.publishedRevisionId} is not null
        and ${titleMatch.status} <> 'archived'
        and ${titleMatch.title} ilike ${pattern} escape '\\'
    )
  )`;
}
