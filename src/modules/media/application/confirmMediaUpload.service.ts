import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { mediaContentPath } from '@/modules/media/domain/mediaApiPath';
import type { MediaAssetDto } from '@/shared/contracts/media.contract';
import { DomainError, NotFoundError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

type MediaAssetRow = typeof mediaAssets.$inferSelect;

@Injectable()
export class ConfirmMediaUploadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly logger: Logger,
  ) {}

  async confirm(ownerId: string, assetId: string): Promise<MediaAssetDto> {
    const asset = await this.findOwnedAsset(ownerId, assetId);

    if (asset.status === 'ready' && asset.confirmedAt !== null) {
      return toMediaAssetDto(asset, mediaContentPath(asset.id));
    }

    if (asset.status === 'rejected') {
      throw new NotFoundError('Файл не найден', { assetId });
    }

    await this.assertStorageMatchesTicket(asset);

    const [ready] = await this.db
      .update(mediaAssets)
      .set({ status: 'ready', confirmedAt: new Date() })
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, ownerId),
          eq(mediaAssets.status, 'pending'),
        ),
      )
      .returning();

    if (ready === undefined) {
      const current = await this.findOwnedAsset(ownerId, assetId);
      if (current.status === 'ready') {
        return toMediaAssetDto(current, mediaContentPath(current.id));
      }
      throw new NotFoundError('Файл не найден', { assetId });
    }

    return toMediaAssetDto(ready, mediaContentPath(ready.id));
  }

  private async findOwnedAsset(ownerId: string, assetId: string): Promise<MediaAssetRow> {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.ownerId, ownerId)))
      .limit(1);

    if (asset === undefined) {
      throw new NotFoundError('Файл не найден', { assetId });
    }

    return asset;
  }

  private async assertStorageMatchesTicket(asset: MediaAssetRow): Promise<void> {
    const head = await this.storage.headObject(asset.storageKey);

    if (head === null) {
      await this.rejectAsset(asset, 'MEDIA_OBJECT_MISSING');
      throw new DomainError(
        'Объект в хранилище не найден',
        { assetId: asset.id },
        { code: ErrorCode.MEDIA_OBJECT_MISSING },
      );
    }

    if (head.contentLength !== asset.byteSize) {
      await this.rejectAsset(asset, 'MEDIA_SIZE_MISMATCH');
      throw new DomainError(
        'Размер файла не совпадает с заявленным',
        {
          assetId: asset.id,
          expected: asset.byteSize,
          actual: head.contentLength,
        },
        { code: ErrorCode.MEDIA_SIZE_MISMATCH },
      );
    }

    if (
      head.contentType !== null &&
      normalizeContentType(head.contentType) !== normalizeContentType(asset.contentType)
    ) {
      await this.rejectAsset(asset, 'MEDIA_CONTENT_TYPE_MISMATCH');
      throw new DomainError(
        'Content-Type файла не совпадает с заявленным',
        {
          assetId: asset.id,
          expected: asset.contentType,
          actual: head.contentType,
        },
        { code: ErrorCode.MEDIA_CONTENT_TYPE_MISMATCH },
      );
    }
  }

  private async rejectAsset(asset: MediaAssetRow, reason: string): Promise<void> {
    await this.db
      .update(mediaAssets)
      .set({ status: 'rejected', confirmedAt: null })
      .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.ownerId, asset.ownerId)));

    try {
      await this.storage.delete(asset.storageKey);
    } catch (error) {
      this.logger.warn(
        { err: error, assetId: asset.id, reason },
        'Не удалось удалить отклонённый объект из хранилища',
      );
    }
  }
}

export function toMediaAssetDto(asset: MediaAssetRow, url: string | null): MediaAssetDto {
  return {
    id: asset.id,
    kind: asset.kind as MediaAssetDto['kind'],
    url,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    status: mapMediaStatus(asset.status),
    createdAt: asset.createdAt.toISOString(),
  };
}

function mapMediaStatus(status: string): MediaAssetDto['status'] {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'rejected') {
    return 'rejected';
  }
  return 'pending';
}

function normalizeContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}
