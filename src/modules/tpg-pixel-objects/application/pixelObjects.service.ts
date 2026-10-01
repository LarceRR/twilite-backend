import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjects, users } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import type {
  PixelObjectDto,
  PixelObjectManifest,
  PixelObjectMobileDto,
  SubmitPixelObjectDto,
} from '@/shared/contracts/pixelObjects.contract';
import { pixelObjectManifestSchema } from '@/shared/contracts/pixelObjects.contract';
import {
  AuthorizationError,
  ConflictError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors';

import { assertPixelObjectSheet } from './assertPixelObjectSheet';
import { toPixelObjectMobileDto } from './toPixelObjectMobileDto';

type PixelObjectStatus = 'pending' | 'published' | 'rejected';
type PixelObjectRow = typeof pixelObjects.$inferSelect;

type JoinedRow = {
  object: PixelObjectRow;
  authorDisplayName: string;
  storageKey: string;
};

@Injectable()
export class PixelObjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(LIMITS) private readonly limits: AppLimits,
  ) {}

  async listPublished(limit = 50): Promise<PixelObjectDto[]> {
    const rows = await this.selectJoined(eq(pixelObjects.status, 'published'), limit);
    return rows.map((row) => this.toDto(row));
  }

  async getPublished(id: string): Promise<PixelObjectDto> {
    const row = await this.findJoined(id);
    if (row === null || row.object.status !== 'published') {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return this.toDto(row);
  }

  async getMobile(id: string): Promise<PixelObjectMobileDto> {
    const published = await this.getPublished(id);
    return toPixelObjectMobileDto({
      id: published.id,
      title: published.title,
      sheetUrl: published.sheetUrl,
      manifest: published.manifest,
    });
  }

  async listMine(authorUserId: string): Promise<PixelObjectDto[]> {
    const rows = await this.selectJoined(eq(pixelObjects.authorUserId, authorUserId));
    return rows.map((row) => this.toDto(row));
  }

  async listPending(): Promise<PixelObjectDto[]> {
    const rows = await this.selectJoined(eq(pixelObjects.status, 'pending'));
    return rows.map((row) => this.toDto(row));
  }

  async submit(authorUserId: string, input: SubmitPixelObjectDto): Promise<PixelObjectDto> {
    await this.assertSheetOwned(authorUserId, input.manifest);

    const [row] = await this.db
      .insert(pixelObjects)
      .values({
        authorUserId,
        title: input.title,
        manifest: input.manifest,
        sheetMediaId: input.manifest.sheet.mediaId,
        status: 'pending',
        revision: 1,
      })
      .returning();

    if (row === undefined) {
      throw new ValidationError('Не удалось сохранить объект');
    }

    const joined = await this.findJoined(row.id);
    if (joined === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return this.toDto(joined);
  }

  async resubmit(
    authorUserId: string,
    id: string,
    input: SubmitPixelObjectDto,
  ): Promise<PixelObjectDto> {
    const existing = await this.requireOwned(id, authorUserId);
    if (existing.status === 'pending') {
      throw new ConflictError('Объект уже на модерации', { code: 'PIXEL_OBJECT_PENDING' });
    }

    await this.assertSheetOwned(authorUserId, input.manifest);

    const [row] = await this.db
      .update(pixelObjects)
      .set({
        title: input.title,
        manifest: input.manifest,
        sheetMediaId: input.manifest.sheet.mediaId,
        status: 'pending',
        rejectionComment: null,
        reviewedByUserId: null,
        reviewedAt: null,
        revision: existing.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pixelObjects.id, id),
          eq(pixelObjects.authorUserId, authorUserId),
          inArray(pixelObjects.status, ['rejected', 'published']),
        ),
      )
      .returning();

    if (row === undefined) {
      throw new ConflictError('Объект уже на модерации', { code: 'PIXEL_OBJECT_PENDING' });
    }

    const joined = await this.findJoined(row.id);
    if (joined === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return this.toDto(joined);
  }

  async publish(reviewerUserId: string, id: string): Promise<PixelObjectDto> {
    return this.review(id, reviewerUserId, 'published', null);
  }

  async reject(reviewerUserId: string, id: string, comment: string): Promise<PixelObjectDto> {
    return this.review(id, reviewerUserId, 'rejected', comment);
  }

  private async review(
    id: string,
    reviewerUserId: string,
    status: Extract<PixelObjectStatus, 'published' | 'rejected'>,
    comment: string | null,
  ): Promise<PixelObjectDto> {
    const found = await this.findJoined(id);
    if (found === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    if (found.object.status !== 'pending') {
      throw new ConflictError('Объект уже обработан', { code: 'PIXEL_OBJECT_ALREADY_REVIEWED' });
    }

    const [row] = await this.db
      .update(pixelObjects)
      .set({
        status,
        rejectionComment: status === 'rejected' ? comment : null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(pixelObjects.id, id), eq(pixelObjects.status, 'pending')))
      .returning();

    if (row === undefined) {
      throw new ConflictError('Объект уже обработан', { code: 'PIXEL_OBJECT_ALREADY_REVIEWED' });
    }

    const joined = await this.findJoined(row.id);
    if (joined === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return this.toDto(joined);
  }

  private async assertSheetOwned(
    authorUserId: string,
    manifest: PixelObjectManifest,
  ): Promise<void> {
    const mediaId = manifest.sheet.mediaId;
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);

    if (asset === undefined) {
      throw new ValidationError('Spritesheet не найден', [
        { path: 'manifest.sheet.mediaId', message: 'Файл не загружен' },
      ]);
    }
    if (asset.ownerId !== authorUserId) {
      throw new AuthorizationError('Нет доступа к spritesheet', { code: 'PIXEL_OBJECT_FORBIDDEN' });
    }
    if (
      asset.kind !== 'pixel-sheet' ||
      asset.contentType !== 'image/png' ||
      asset.status !== 'ready'
    ) {
      throw new ValidationError('Spritesheet не готов', [
        { path: 'manifest.sheet.mediaId', message: 'Нужен подтверждённый PNG pixel-sheet' },
      ]);
    }
    if (asset.byteSize > this.limits.tpg.pixelObjectSheetMaxBytes) {
      throw new ValidationError('Spritesheet слишком большой', [
        {
          path: 'manifest.sheet',
          message: `Максимум ${this.limits.tpg.pixelObjectSheetMaxBytes} байт`,
        },
      ]);
    }

    const png = await this.storage.getObject(asset.storageKey);
    await assertPixelObjectSheet(png, manifest, {
      maxFrames: this.limits.tpg.pixelObjectMaxFrames,
      maxBytes: this.limits.tpg.pixelObjectSheetMaxBytes,
    });
  }

  private async requireOwned(id: string, authorUserId: string): Promise<PixelObjectRow> {
    const [row] = await this.db.select().from(pixelObjects).where(eq(pixelObjects.id, id)).limit(1);
    if (row === undefined) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    if (row.authorUserId !== authorUserId) {
      throw new AuthorizationError('Нет доступа к объекту', { code: 'PIXEL_OBJECT_FORBIDDEN' });
    }
    return row;
  }

  private async findJoined(id: string): Promise<JoinedRow | null> {
    const [row] = await this.selectJoined(eq(pixelObjects.id, id), 1);
    return row ?? null;
  }

  private async selectJoined(where: SQL | undefined, limit?: number): Promise<JoinedRow[]> {
    const query = this.db
      .select({
        object: pixelObjects,
        authorDisplayName: users.displayName,
        storageKey: mediaAssets.storageKey,
      })
      .from(pixelObjects)
      .innerJoin(users, eq(users.id, pixelObjects.authorUserId))
      .innerJoin(mediaAssets, eq(mediaAssets.id, pixelObjects.sheetMediaId))
      .where(where)
      .orderBy(desc(pixelObjects.updatedAt));

    const rows = limit === undefined ? await query : await query.limit(limit);
    return rows;
  }

  private toDto(row: JoinedRow): PixelObjectDto {
    const manifest = pixelObjectManifestSchema.parse(row.object.manifest);
    const sheetUrl = this.storage.publicUrl(row.storageKey);
    if (sheetUrl === null || sheetUrl.length === 0) {
      throw new InfrastructureError('Публичный URL spritesheet недоступен');
    }

    return {
      id: row.object.id,
      title: row.object.title,
      authorDisplayName: row.authorDisplayName,
      authorUserId: row.object.authorUserId,
      status: row.object.status,
      rejectionComment: row.object.rejectionComment,
      revision: row.object.revision,
      manifest,
      sheetUrl,
      createdAt: row.object.createdAt.toISOString(),
      updatedAt: row.object.updatedAt.toISOString(),
      reviewedAt: row.object.reviewedAt?.toISOString() ?? null,
    };
  }
}
