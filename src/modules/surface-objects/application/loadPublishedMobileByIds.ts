import { eq, inArray } from 'drizzle-orm';
import type { Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjectRevisions, pixelObjects } from '@/database/schema';
import type { StoragePort } from '@/infrastructure/storage/StoragePort';
import { toPixelObjectMobileDto } from '@/modules/tpg-pixel-objects/application/toPixelObjectMobileDto';
import type { PixelObjectMobileDto } from '@/shared/contracts/pixelObjects.contract';
import { pixelObjectManifestSchema } from '@/shared/contracts/pixelObjects.contract';

/** Batch-load published mobile DTOs for surface embeds (P2-S7). No N+1. */
export async function loadPublishedMobileByIds(
  db: Database,
  storage: StoragePort,
  ids: readonly string[],
): Promise<Map<string, PixelObjectMobileDto>> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  const result = new Map<string, PixelObjectMobileDto>();
  if (unique.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      objectId: pixelObjects.id,
      title: pixelObjects.title,
      revisionNumber: pixelObjectRevisions.revisionNumber,
      manifest: pixelObjectRevisions.manifest,
      storageKey: mediaAssets.storageKey,
    })
    .from(pixelObjects)
    .innerJoin(pixelObjectRevisions, eq(pixelObjectRevisions.id, pixelObjects.publishedRevisionId))
    .innerJoin(mediaAssets, eq(mediaAssets.id, pixelObjectRevisions.sheetMediaId))
    .where(inArray(pixelObjects.id, unique));

  for (const row of rows) {
    const parsed = pixelObjectManifestSchema.safeParse(row.manifest);
    if (!parsed.success) {
      continue;
    }
    const sheetUrl = storage.publicUrl(row.storageKey);
    if (sheetUrl === null || sheetUrl.length === 0) {
      continue;
    }
    result.set(
      row.objectId,
      toPixelObjectMobileDto({
        id: row.objectId,
        title: row.title,
        sheetUrl,
        manifest: parsed.data,
        revision: row.revisionNumber,
      }),
    );
  }
  return result;
}
