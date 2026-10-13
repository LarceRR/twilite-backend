import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type { Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';
import type { StoragePort } from '@/infrastructure/storage/StoragePort';
import type { PixelObjectManifest } from '@/shared/contracts/pixelObjects.contract';

/** Extract staticPreviewFrame cell from spritesheet and store as ready media (P2-S11). */
export async function createPreviewMedia(params: {
  readonly db: Database;
  readonly storage: StoragePort;
  readonly ownerUserId: string;
  readonly sheetPng: Buffer;
  readonly manifest: PixelObjectManifest;
}): Promise<string> {
  const { sheet, staticPreviewFrame, canvas } = params.manifest;
  const col = staticPreviewFrame % sheet.columns;
  const row = Math.floor(staticPreviewFrame / sheet.columns);
  const left = col * sheet.frameWidth;
  const top = row * sheet.frameHeight;
  const preview = await sharp(params.sheetPng)
    .extract({
      left,
      top,
      width: sheet.frameWidth,
      height: sheet.frameHeight,
    })
    .png()
    .toBuffer();

  const assetId = randomUUID();
  const storageKey = `pixel-preview/${assetId}.png`;
  await params.storage.putObject({
    key: storageKey,
    body: preview,
    contentType: 'image/png',
  });

  try {
    await params.db.insert(mediaAssets).values({
      id: assetId,
      ownerId: params.ownerUserId,
      kind: 'pixel-preview',
      storageKey,
      contentType: 'image/png',
      byteSize: preview.byteLength,
      status: 'ready',
      confirmedAt: new Date(),
    });
  } catch (error) {
    await params.storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  void canvas;
  return assetId;
}
