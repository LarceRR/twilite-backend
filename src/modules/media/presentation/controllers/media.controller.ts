import { randomUUID } from 'node:crypto';
import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { createZodDto } from 'nestjs-zod';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { EntitlementsService } from '@/modules/billing/application/services/entitlements.service';
import type { MediaAssetDto, UploadTicketDto } from '@/shared/contracts/media.contract';
import {
  createUploadRequestSchema,
  mediaAssetSchema,
  uploadTicketSchema,
} from '@/shared/contracts/media.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { InfrastructureError, NotFoundError } from '@/shared/errors';

class CreateUploadDto extends createZodDto(createUploadRequestSchema) {}
class UploadTicketResponseDto extends createZodDto(uploadTicketSchema) {}
class MediaAssetResponseDto extends createZodDto(mediaAssetSchema) {}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Two steps by design: the API issues a presigned URL, the client uploads
   * directly, then confirms. Bytes never pass through the API process.
   */
  @Post('uploads')
  @ApiOperation({ summary: 'Получить ссылку для загрузки файла' })
  @ApiOkResponse({ type: UploadTicketResponseDto })
  async createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateUploadDto,
  ): Promise<UploadTicketDto> {
    if (body.kind === 'voice') {
      await this.entitlements.assertGranted(user.userId, 'canUploadVoice');
    }

    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    const storageKey = `${user.userId}/${body.kind}/${randomUUID()}`;

    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        ownerId: user.userId,
        spaceId: body.spaceId ?? null,
        kind: body.kind,
        storageKey,
        contentType: body.contentType,
        byteSize: body.byteSize,
      })
      .returning();

    if (asset === undefined) {
      throw new InfrastructureError('Не удалось создать запись о файле');
    }

    const upload = await this.storage.createUploadUrl({
      key: storageKey,
      contentType: body.contentType,
      byteSize: body.byteSize,
    });

    return {
      assetId: asset.id,
      uploadUrl: upload.url,
      storageKey,
      expiresAt: upload.expiresAt.toISOString(),
    };
  }

  @Post('uploads/:assetId/confirm')
  @ApiOperation({ summary: 'Подтвердить успешную загрузку' })
  @ApiOkResponse({ type: MediaAssetResponseDto })
  async confirm(@Param('assetId') assetId: string): Promise<MediaAssetDto> {
    const [asset] = await this.db
      .update(mediaAssets)
      .set({ status: 'ready', confirmedAt: new Date() })
      .where(eq(mediaAssets.id, assetId))
      .returning();

    if (asset === undefined) {
      throw new NotFoundError('Файл не найден', { assetId });
    }

    return {
      id: asset.id,
      kind: asset.kind as MediaAssetDto['kind'],
      url: this.storage.publicUrl(asset.storageKey),
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      status: 'ready',
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
