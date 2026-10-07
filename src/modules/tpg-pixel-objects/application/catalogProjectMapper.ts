import { projectAvatarPath, userAvatarPath } from '@/modules/media/domain/mediaApiPath';
import type { PixelObjectManifest } from '@/shared/contracts/pixelObjects.contract';

import { encodeCatalogCursor } from './catalogCursor';
import {
  type CatalogMomentDto,
  type CatalogPageDto,
  type CatalogProjectDto,
  type CatalogSpriteDto,
  catalogPageSchema,
} from './catalogPageSchema';
import { CATALOG_MOMENTS_PER_PROJECT } from './catalogProjectsQuery';
import { parseManifestSafely, toIsoStringOrNull } from './pixelObjectQueries';
import { pixelObjectPreviewPath, pixelObjectSheetPath } from './pixelObjectSheetPath';

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CatalogProjectSource = {
  readonly id: string;
  readonly title: string;
  readonly authorDisplayName: string;
  readonly official: boolean;
  readonly avatarUrl: string | null;
  readonly objectCount: number;
  readonly byteSize: number;
  readonly latestAt: string;
};

export type CatalogMomentSource = {
  readonly projectId: string;
  readonly id: string;
  readonly title: string;
  readonly revisionNumber: number;
  readonly manifest: unknown;
  readonly hasPreview: boolean;
  readonly rank: number;
};

export function toNonNegativeInt(value: unknown): number {
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

export function readUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_TEXT.test(value) ? value : null;
}

export function readBoundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

export function spriteFromManifest(
  objectId: string,
  revision: number,
  manifest: PixelObjectManifest,
): CatalogSpriteDto | null {
  const animation = manifest.animations[0];
  if (animation === undefined) return null;
  return {
    sheetUrl: pixelObjectSheetPath(objectId, revision),
    frameWidth: manifest.sheet.frameWidth,
    frameHeight: manifest.sheet.frameHeight,
    columns: manifest.sheet.columns,
    rows: manifest.sheet.rows,
    frameCount: manifest.sheet.frameCount,
    frames: animation.frames.map((frame) => ({
      frame: frame.frame,
      durationMs: frame.durationMs,
    })),
    staticPreviewFrame: manifest.staticPreviewFrame,
  };
}

export function toCatalogMoment(source: CatalogMomentSource): CatalogMomentDto | null {
  const manifest = parseManifestSafely(source.manifest, source.id);
  if (manifest === null) return null;
  return {
    id: source.id,
    title: source.title,
    previewUrl: source.hasPreview ? pixelObjectPreviewPath(source.id, source.revisionNumber) : null,
    sprite: spriteFromManifest(source.id, source.revisionNumber, manifest),
  };
}

export function groupCatalogMoments(
  sources: readonly CatalogMomentSource[],
): ReadonlyMap<string, readonly CatalogMomentDto[]> {
  const ordered = [...sources].sort((left, right) => left.rank - right.rank);
  const grouped = new Map<string, CatalogMomentDto[]>();
  for (const source of ordered) {
    const moment = toCatalogMoment(source);
    if (moment === null) continue;
    const bucket = grouped.get(source.projectId) ?? [];
    if (bucket.length >= CATALOG_MOMENTS_PER_PROJECT) continue;
    bucket.push(moment);
    grouped.set(source.projectId, bucket);
  }
  return grouped;
}

export function toCatalogProject(
  source: CatalogProjectSource,
  moments: readonly CatalogMomentDto[],
): CatalogProjectDto {
  return {
    id: source.id,
    title: source.title,
    authorDisplayName: source.authorDisplayName,
    avatarUrl: source.avatarUrl,
    official: source.official,
    objectCount: source.objectCount,
    byteSize: source.byteSize,
    moments: [...moments],
  };
}

export function catalogPageFromSources(
  projects: readonly CatalogProjectSource[],
  moments: readonly CatalogMomentSource[],
  limit: number,
): CatalogPageDto {
  const page = projects.slice(0, limit);
  const byProject = groupCatalogMoments(moments);
  const items = page.map((project) => toCatalogProject(project, byProject.get(project.id) ?? []));
  const parsed = catalogPageSchema.safeParse({
    items,
    nextCursor: nextCursor(projects, limit),
  });
  if (!parsed.success) {
    throw new Error('Catalog page failed its response schema');
  }
  return parsed.data;
}

export function toCatalogProjectSource(row: {
  readonly projectId: unknown;
  readonly title: unknown;
  readonly authorDisplayName: unknown;
  readonly official: unknown;
  readonly ownerId: unknown;
  readonly userAvatarKey: unknown;
  readonly avatarStorageKey: unknown;
  readonly objectCount: unknown;
  readonly byteSize: unknown;
  readonly latestAt: unknown;
}): CatalogProjectSource | null {
  const id = readUuid(row.projectId);
  const title = readBoundedText(row.title, 80);
  const author = readBoundedText(row.authorDisplayName, 80);
  const latestAt = toIsoStringOrNull(readTimestamp(row.latestAt));
  if (id === null || title === null || author === null || latestAt === null) return null;
  return {
    id,
    title,
    authorDisplayName: author,
    official: row.official === true || row.official === 't' || row.official === 'true',
    avatarUrl: catalogAvatarUrl({
      projectId: id,
      ownerId: readUuid(row.ownerId),
      userAvatarKey: row.userAvatarKey,
      projectAvatarKey: row.avatarStorageKey,
      hasPreview: false,
    }),
    objectCount: toNonNegativeInt(row.objectCount),
    byteSize: toNonNegativeInt(row.byteSize),
    latestAt,
  };
}

export function catalogAvatarUrl(input: {
  readonly projectId: string;
  readonly ownerId: string | null;
  readonly userAvatarKey: unknown;
  readonly projectAvatarKey: unknown;
  readonly hasPreview: boolean;
}): string | null {
  if (hasStorageKey(input.userAvatarKey) && input.ownerId !== null) {
    return userAvatarPath(input.ownerId);
  }
  if (hasStorageKey(input.projectAvatarKey) || input.hasPreview) {
    return projectAvatarPath(input.projectId);
  }
  return null;
}

export function fillPreviewAvatar(
  source: CatalogProjectSource,
  hasPreview: boolean,
): CatalogProjectSource {
  if (source.avatarUrl !== null || !hasPreview) return source;
  return {
    ...source,
    avatarUrl: catalogAvatarUrl({
      projectId: source.id,
      ownerId: null,
      userAvatarKey: null,
      projectAvatarKey: null,
      hasPreview: true,
    }),
  };
}

export function toCatalogMomentSource(row: {
  readonly projectId: unknown;
  readonly id: unknown;
  readonly title: unknown;
  readonly revisionNumber: unknown;
  readonly manifest: unknown;
  readonly previewKey: unknown;
  readonly rank: unknown;
}): CatalogMomentSource | null {
  const projectId = readUuid(row.projectId);
  const id = readUuid(row.id);
  const title = readBoundedText(row.title, 80);
  const revisionNumber = toNonNegativeInt(row.revisionNumber);
  const rank = toNonNegativeInt(row.rank);
  if (projectId === null || id === null || title === null || revisionNumber < 1 || rank < 1) {
    return null;
  }
  return {
    projectId,
    id,
    title,
    revisionNumber,
    manifest: row.manifest,
    hasPreview: typeof row.previewKey === 'string' && row.previewKey.length > 0,
    rank,
  };
}

function hasStorageKey(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function readTimestamp(value: unknown): Date | string | null {
  if (value instanceof Date || typeof value === 'string') return value;
  return null;
}

function nextCursor(projects: readonly CatalogProjectSource[], limit: number): string | null {
  if (projects.length <= limit) return null;
  const last = projects[limit - 1];
  if (last === undefined) return null;
  const publishedAt = toIsoStringOrNull(last.latestAt);
  if (publishedAt === null) return null;
  return encodeCatalogCursor({ publishedAt, id: last.id });
}
