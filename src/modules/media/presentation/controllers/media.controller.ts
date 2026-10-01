import { Body, Controller, Headers, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets } from '@/database/schema';
import {
  IMMUTABLE_OBJECT_CACHE_CONTROL,
  STORAGE,
  type StoragePort,
} from '@/infrastructure/storage/StoragePort';
import { EntitlementsService } from '@/modules/billing/application/services/entitlements.service';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { MediaAssetDto, UploadTicketDto } from '@/shared/contracts/media.contract';
import {
  createUploadRequestSchema,
  mediaAssetSchema,
  uploadTicketSchema,
} from '@/shared/contracts/media.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';
import { InfrastructureError } from '@/shared/errors';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import {
  assertMediaUploadPolicy,
  mediaQuotaExceededError,
} from '../../application/assertMediaUploadPolicy';
import { ConfirmMediaUploadService } from '../../application/confirmMediaUpload.service';
import { countUploadsToday } from '../../application/countUploadsToday';
import { buildOpaqueStorageKey } from '../../domain/opaqueStorageKey';

class CreateUploadDto extends createZodDto(createUploadRequestSchema) {}
class UploadTicketResponseDto extends createZodDto(uploadTicketSchema) {}
class MediaAssetResponseDto extends createZodDto(mediaAssetSchema) {}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(LIMITS) private readonly limits: AppLimits,
    private readonly entitlements: EntitlementsService,
    private readonly confirmUpload: ConfirmMediaUploadService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Two steps by design: the API issues a presigned URL, the client uploads
   * directly, then confirms. Bytes never pass through the API process.
   */
  @Post('uploads')
  @RequireRbac('twilite.media.upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Получить ссылку для загрузки файла' })
  @ApiOkResponse({ type: UploadTicketResponseDto })
  async createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateUploadDto,
  ): Promise<UploadTicketDto> {
    return this.idempotency.execute({
      key: idempotencyKey,
      scope: `media:upload:${user.userId}`,
      payload: body,
      operation: () => this.createUploadOnce(user.userId, body),
    });
  }

  @Post('uploads/:assetId/confirm')
  @RequireRbac('twilite.media.confirm')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Подтвердить успешную загрузку' })
  @ApiOkResponse({ type: MediaAssetResponseDto })
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<MediaAssetDto> {
    return this.idempotency.execute({
      key: idempotencyKey,
      scope: `media:confirm:${user.userId}:${assetId}`,
      payload: { assetId },
      operation: () => this.confirmUpload.confirm(user.userId, assetId),
    });
  }

  private async createUploadOnce(userId: UserId, body: CreateUploadDto): Promise<UploadTicketDto> {
    if (body.kind === 'voice') {
      await this.entitlements.assertGranted(userId, 'canUploadVoice');
    }

    assertMediaUploadPolicy({
      kind: body.kind,
      contentType: body.contentType,
      byteSize: body.byteSize,
      limits: this.limits,
    });

    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    const used = await countUploadsToday(this.db, userId);
    if (used >= this.limits.media.uploadsPerUserPerDay) {
      throw mediaQuotaExceededError(this.limits.media.uploadsPerUserPerDay);
    }

    const storageKey = buildOpaqueStorageKey(body.kind);

    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        ownerId: userId,
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
      cacheControl: IMMUTABLE_OBJECT_CACHE_CONTROL,
    });

    return {
      assetId: asset.id,
      uploadUrl: upload.url,
      storageKey,
      expiresAt: upload.expiresAt.toISOString(),
      headers: {
        'Content-Type': body.contentType,
        'Cache-Control': IMMUTABLE_OBJECT_CACHE_CONTROL,
      },
    };
  }
}
