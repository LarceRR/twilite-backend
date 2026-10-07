import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { DomainError, InfrastructureError, NotFoundError, ValidationError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

@Injectable()
export class ReceiveMediaUploadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(LIMITS) private readonly limits: AppLimits,
  ) {}

  /** Store bytes for a pending ticket. The client never receives a bucket URL. */
  async receive(
    ownerId: string,
    assetId: string,
    body: Buffer,
    contentTypeHeader: string | undefined,
  ): Promise<void> {
    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.ownerId, ownerId)))
      .limit(1);

    if (asset === undefined || asset.status === 'rejected') {
      throw new NotFoundError('Файл не найден', { assetId });
    }
    if (asset.status !== 'pending') {
      throw new ValidationError('Файл уже загружен', [
        { path: 'assetId', message: 'Повторная загрузка не нужна' },
      ]);
    }

    const expiresAt = asset.createdAt.getTime() + this.limits.media.signedUrlTtlSeconds * 1000;
    if (Date.now() > expiresAt) {
      throw new ValidationError('Срок загрузки истёк', [
        { path: 'assetId', message: 'Запросите новую ссылку' },
      ]);
    }

    const contentType = normalizeContentType(contentTypeHeader);
    if (contentType.length === 0 || contentType !== normalizeContentType(asset.contentType)) {
      throw new ValidationError('Content-Type не совпадает с заявленным', [
        { path: 'contentType', message: `Ожидается ${asset.contentType}` },
      ]);
    }
    if (body.byteLength !== asset.byteSize) {
      throw new DomainError(
        'Размер файла не совпадает с заявленным',
        { assetId, expected: asset.byteSize, actual: body.byteLength },
        { code: ErrorCode.MEDIA_SIZE_MISMATCH },
      );
    }

    await this.storage.putObject({
      key: asset.storageKey,
      body,
      contentType: asset.contentType,
    });
  }

  /** Bytes for `GET /v1/media/:assetId`. Only the owner of a ready asset. */
  async readOwned(
    ownerId: string,
    assetId: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, ownerId),
          eq(mediaAssets.status, 'ready'),
        ),
      )
      .limit(1);

    if (asset === undefined) {
      throw new NotFoundError('Файл не найден', { assetId });
    }

    const maxBytes = Math.max(
      this.limits.media.imageMaxBytes,
      this.limits.media.audioMaxBytes,
      this.limits.media.avatarMaxBytes,
    );
    const body = await this.storage.getObject(asset.storageKey, { maxBytes });
    return { body, contentType: asset.contentType };
  }
}

function normalizeContentType(value: string | undefined): string {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}
