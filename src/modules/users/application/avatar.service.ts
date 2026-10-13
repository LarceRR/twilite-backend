import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, users } from '@/database/schema';
import {
  IMMUTABLE_OBJECT_CACHE_CONTROL,
  STORAGE,
  type StoragePort,
} from '@/infrastructure/storage/StoragePort';
import {
  mediaContentPath,
  mediaUploadPath,
  userAvatarPath,
} from '@/modules/media/domain/mediaApiPath';
import { buildOpaqueStorageKey } from '@/modules/media/domain/opaqueStorageKey';
import type {
  CreateAvatarUploadRequest,
  MediaAssetDto,
  UploadTicketDto,
} from '@/shared/contracts/media.contract';
import { InfrastructureError, NotFoundError, ValidationError } from '@/shared/errors';

import type { User } from '../domain/entities/User';
import { USER_REPOSITORY, type UserRepository } from '../domain/repositories/UserRepository';
import type { UserId } from '../domain/value-objects/UserId';

@Injectable()
export class AvatarService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(LIMITS) private readonly limits: AppLimits,
    private readonly logger: Logger,
  ) {}

  async createUpload(userId: UserId, body: CreateAvatarUploadRequest): Promise<UploadTicketDto> {
    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    if (body.byteSize > this.limits.media.avatarMaxBytes) {
      throw new ValidationError('Файл аватара слишком большой', [
        {
          path: 'byteSize',
          message: `Максимум ${this.limits.media.avatarMaxBytes} байт`,
        },
      ]);
    }

    const storageKey = buildOpaqueStorageKey('avatar');

    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        ownerId: userId,
        kind: 'avatar',
        storageKey,
        contentType: body.contentType,
        byteSize: body.byteSize,
      })
      .returning();

    if (asset === undefined) {
      throw new InfrastructureError('Не удалось создать запись о файле');
    }

    return {
      assetId: asset.id,
      uploadUrl: mediaUploadPath(asset.id),
      storageKey,
      expiresAt: new Date(Date.now() + this.limits.media.signedUrlTtlSeconds * 1000).toISOString(),
      headers: {
        'Content-Type': body.contentType,
        'Cache-Control': IMMUTABLE_OBJECT_CACHE_CONTROL,
      },
    };
  }

  async confirm(userId: UserId, assetId: string): Promise<{ user: User; asset: MediaAssetDto }> {
    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, userId),
          eq(mediaAssets.kind, 'avatar'),
        ),
      )
      .limit(1);

    if (asset === undefined) {
      throw new NotFoundError('Файл аватара не найден', { assetId });
    }

    if (asset.status === 'ready' && asset.confirmedAt !== null) {
      const user = await this.users.findById(userId);

      if (user === null) {
        throw new NotFoundError('Пользователь не найден', { userId });
      }

      return { user, asset: toAssetDto(asset, mediaContentPath(asset.id)) };
    }

    const [ready] = await this.db
      .update(mediaAssets)
      .set({ status: 'ready', confirmedAt: new Date() })
      .where(eq(mediaAssets.id, assetId))
      .returning();

    if (ready === undefined) {
      throw new NotFoundError('Файл аватара не найден', { assetId });
    }

    const { user, previousStorageKey } = await this.users.setAvatar(userId, {
      avatarUrl: userAvatarPath(userId),
      avatarStorageKey: ready.storageKey,
    });

    if (
      previousStorageKey !== null &&
      previousStorageKey.length > 0 &&
      previousStorageKey !== ready.storageKey
    ) {
      try {
        await this.storage.delete(previousStorageKey);
      } catch (error) {
        this.logger.warn(
          { err: error, previousStorageKey, userId },
          'Не удалось удалить предыдущий аватар из хранилища',
        );
      }
    }

    return { user, asset: toAssetDto(ready, mediaContentPath(ready.id)) };
  }

  async read(userId: string): Promise<{ body: Buffer; contentType: string }> {
    const [user] = await this.db
      .select({ avatarStorageKey: users.avatarStorageKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const storageKey = user?.avatarStorageKey;
    if (storageKey === undefined || storageKey === null || storageKey.length === 0) {
      throw new NotFoundError('Аватар не найден', { userId });
    }

    const [asset] = await this.db
      .select({ contentType: mediaAssets.contentType })
      .from(mediaAssets)
      .where(eq(mediaAssets.storageKey, storageKey))
      .limit(1);

    const body = await this.storage.getObject(storageKey, {
      maxBytes: this.limits.media.avatarMaxBytes,
    });
    return { body, contentType: asset?.contentType ?? 'image/jpeg' };
  }
}

function toAssetDto(asset: typeof mediaAssets.$inferSelect, url: string | null): MediaAssetDto {
  return {
    id: asset.id,
    kind: 'avatar',
    url,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    status: asset.status === 'ready' ? 'ready' : 'pending',
    createdAt: asset.createdAt.toISOString(),
  };
}
