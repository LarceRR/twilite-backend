import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PixelObjectLimits } from '@twilite/contracts';
import { and, eq, isNotNull, or, type SQL } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { mediaAssets, pixelObjectRevisions, pixelObjects } from '@/database/schema';
import { STORAGE, type StoragePort } from '@/infrastructure/storage/StoragePort';
import { ProjectsService } from '@/modules/tpg-projects/application/projects.service';
import { AuditLogService } from '@/shared/audit/auditLog.service';
import type {
  PixelObjectDto,
  PixelObjectManifest,
  PixelObjectMobileDto,
  ReassignPixelObjectDto,
  SubmitPixelObjectDto,
} from '@/shared/contracts/pixelObjects.contract';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import {
  domainEventNames,
  type PixelObjectArchivedEvent,
  type PixelObjectPublishedEvent,
} from '@/shared/events/domainEvents';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

import { assertPixelObjectSheet } from './assertPixelObjectSheet';
import { type CatalogListQuery, decodeCatalogCursor, encodeCatalogCursor } from './catalogCursor';
import { createPreviewMedia } from './createPreviewMedia';
import {
  authorCursorWhere,
  type JoinedPixelObject,
  type PixelObjectRow,
  publishedCursorWhere,
  selectAuthorJoined,
  selectPublishedJoined,
  toPixelObjectDto,
} from './pixelObjectQueries';
import { revisionContentHash } from './revisionBackfill';
import { toPixelObjectLimitsDto } from './toPixelObjectLimitsDto';
import { toPixelObjectMobileDto } from './toPixelObjectMobileDto';

@Injectable()
export class PixelObjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(LIMITS) private readonly limits: AppLimits,
    private readonly projects: ProjectsService,
    private readonly logger: Logger,
    private readonly events: EventEmitter2,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditLogService,
  ) {}

  getLimits(): PixelObjectLimits {
    return toPixelObjectLimitsDto(this.limits);
  }

  async listPublished(
    query: CatalogListQuery = { limit: 20 },
  ): Promise<{ items: PixelObjectDto[]; nextCursor: string | null }> {
    const cursor = query.cursor ? decodeCatalogCursor(query.cursor) : null;
    if (query.cursor && cursor === null) {
      throw new ValidationError('Некорректный cursor', [
        { path: 'cursor', message: 'Ожидается opaque catalog cursor' },
      ]);
    }
    const where = cursor === null ? undefined : publishedCursorWhere(cursor);
    const rows = await selectPublishedJoined(this.db, where, query.limit + 1);
    return this.toPage(rows, query.limit);
  }

  async getPublished(id: string): Promise<PixelObjectDto> {
    const rows = await selectPublishedJoined(this.db, eq(pixelObjects.id, id), 1);
    const dto = rows[0] ? toPixelObjectDto(rows[0], this.storage) : null;
    if (dto === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return dto;
  }

  async getMobile(id: string): Promise<PixelObjectMobileDto> {
    const published = await this.getPublished(id);
    return toPixelObjectMobileDto({
      id: published.id,
      title: published.title,
      sheetUrl: published.sheetUrl,
      manifest: published.manifest,
      revision: published.revision,
    });
  }

  async listMine(
    authorUserId: string,
    query: CatalogListQuery & { readonly projectId?: string | undefined } = { limit: 20 },
  ): Promise<{ items: PixelObjectDto[]; nextCursor: string | null }> {
    const filters = [eq(pixelObjects.authorUserId, authorUserId)];
    if (query.projectId !== undefined) {
      filters.push(eq(pixelObjects.projectId, query.projectId));
    }
    return this.listAuthorPage(and(...filters)!, query);
  }

  async listPending(
    query: CatalogListQuery = { limit: 20 },
  ): Promise<{ items: PixelObjectDto[]; nextCursor: string | null }> {
    const filter = or(
      eq(pixelObjects.status, 'pending'),
      and(eq(pixelObjects.status, 'published'), isNotNull(pixelObjects.pendingRevisionId)),
    );
    if (filter === undefined) {
      throw new Error('listPending: empty SQL expression');
    }
    return this.listAuthorPage(filter, query);
  }

  private async listAuthorPage(
    filter: SQL,
    query: CatalogListQuery,
  ): Promise<{ items: PixelObjectDto[]; nextCursor: string | null }> {
    const cursor = query.cursor ? decodeCatalogCursor(query.cursor) : null;
    if (query.cursor && cursor === null) {
      throw new ValidationError('Некорректный cursor', [
        { path: 'cursor', message: 'Ожидается opaque catalog cursor' },
      ]);
    }
    const where = cursor === null ? filter : and(filter, authorCursorWhere(cursor));
    const rows = await selectAuthorJoined(this.db, where, query.limit + 1);
    return this.toPage(rows, query.limit);
  }

  private toPage(
    rows: JoinedPixelObject[],
    limit: number,
  ): { items: PixelObjectDto[]; nextCursor: string | null } {
    const mapped = this.mapRowsQuarantine(rows);
    const page = mapped.slice(0, limit);
    const lastRow = rows[Math.min(page.length, rows.length) - 1];
    // Align cursor with last *returned* DTO id when quarantine drops rows.
    const lastDto = page[page.length - 1];
    const cursorRow =
      lastDto === undefined
        ? undefined
        : (rows.find((row) => row.object.id === lastDto.id) ?? lastRow);
    const nextCursor =
      mapped.length > limit && cursorRow?.sortAt != null
        ? encodeCatalogCursor({
            publishedAt: cursorRow.sortAt.toISOString(),
            id: cursorRow.object.id,
          })
        : null;
    return { items: page, nextCursor };
  }

  async submit(
    authorUserId: string,
    input: SubmitPixelObjectDto,
    idempotencyKey?: string | null,
  ): Promise<PixelObjectDto> {
    return this.idempotency.execute({
      key: idempotencyKey,
      scope: `pixel-object:submit:${authorUserId}`,
      payload: input,
      operation: () => this.submitOnce(authorUserId, input),
    });
  }

  async resubmit(
    authorUserId: string,
    id: string,
    input: SubmitPixelObjectDto,
    idempotencyKey?: string | null,
  ): Promise<PixelObjectDto> {
    return this.idempotency.execute({
      key: idempotencyKey,
      scope: `pixel-object:resubmit:${authorUserId}:${id}`,
      payload: input,
      operation: () => this.resubmitOnce(authorUserId, id, input),
    });
  }

  private async submitOnce(
    authorUserId: string,
    input: SubmitPixelObjectDto,
  ): Promise<PixelObjectDto> {
    await this.projects.assertWritableProject(authorUserId, input.projectId);
    const sheetPng = await this.assertSheetOwned(authorUserId, input.manifest);
    const objectId = await this.db.transaction(async (tx) => {
      const previewMediaId = await createPreviewMedia({
        db: tx as unknown as Database,
        storage: this.storage,
        ownerUserId: authorUserId,
        sheetPng,
        manifest: input.manifest,
      });
      const [head] = await tx
        .insert(pixelObjects)
        .values({
          projectId: input.projectId,
          authorUserId,
          title: input.title,
          manifest: input.manifest,
          sheetMediaId: input.manifest.sheet.mediaId,
          status: 'pending',
          revision: 1,
        })
        .returning();
      if (head === undefined) {
        throw new ValidationError('Не удалось сохранить объект');
      }
      const revisionId = await this.insertPendingRevision(tx, head.id, 1, input, previewMediaId);
      await tx
        .update(pixelObjects)
        .set({ pendingRevisionId: revisionId, updatedAt: new Date() })
        .where(eq(pixelObjects.id, head.id));
      return head.id;
    });
    return this.requireAuthorDto(objectId);
  }

  private async resubmitOnce(
    authorUserId: string,
    id: string,
    input: SubmitPixelObjectDto,
  ): Promise<PixelObjectDto> {
    const existing = await this.requireOwned(id, authorUserId);
    if (existing.projectId !== input.projectId) {
      throw new ValidationError('Нельзя сменить проект при повторной отправке', [
        { path: 'projectId', message: 'Должен совпадать с текущим проектом объекта' },
      ]);
    }
    await this.assertNoActivePending(existing);
    const sheetPng = await this.assertSheetOwned(authorUserId, input.manifest);

    await this.db.transaction(async (tx) => {
      const previewMediaId = await createPreviewMedia({
        db: tx as unknown as Database,
        storage: this.storage,
        ownerUserId: authorUserId,
        sheetPng,
        manifest: input.manifest,
      });
      const nextRevision = existing.revision + 1;
      const revisionId = await this.insertPendingRevision(
        tx,
        id,
        nextRevision,
        input,
        previewMediaId,
      );
      const keepPublished = existing.publishedRevisionId !== null;
      await tx
        .update(pixelObjects)
        .set({
          title: input.title,
          manifest: keepPublished ? existing.manifest : input.manifest,
          sheetMediaId: keepPublished ? existing.sheetMediaId : input.manifest.sheet.mediaId,
          status: keepPublished ? 'published' : 'pending',
          rejectionComment: keepPublished ? existing.rejectionComment : null,
          reviewedByUserId: keepPublished ? existing.reviewedByUserId : null,
          reviewedAt: keepPublished ? existing.reviewedAt : null,
          revision: nextRevision,
          pendingRevisionId: revisionId,
          updatedAt: new Date(),
        })
        .where(eq(pixelObjects.id, id));
    });

    return this.requireAuthorDto(id);
  }

  async archive(actorUserId: string, id: string): Promise<PixelObjectDto> {
    const head = await this.requireOwned(id, actorUserId);
    if (head.publishedRevisionId === null && head.status !== 'published') {
      throw new ConflictError('Архивировать можно только опубликованный объект');
    }
    await this.db
      .update(pixelObjects)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(pixelObjects.id, id));
    this.events.emit(domainEventNames.pixelObjectArchived, {
      pixelObjectId: id,
      revision: head.revision,
    } satisfies PixelObjectArchivedEvent);
    return this.requireAuthorDto(id);
  }

  async reassign(
    actorUserId: string,
    id: string,
    input: ReassignPixelObjectDto,
  ): Promise<PixelObjectDto> {
    const existing = await this.requireOwned(id, actorUserId);
    if (existing.projectId === input.toProjectId) {
      return this.requireAuthorDto(id);
    }
    const target = await this.projects.requireProjectRow(input.toProjectId);
    await this.projects.assertWritableProject(target.ownerId, input.toProjectId);
    await this.db
      .update(pixelObjects)
      .set({
        projectId: input.toProjectId,
        authorUserId: target.ownerId,
        updatedAt: new Date(),
      })
      .where(eq(pixelObjects.id, id));
    return this.requireAuthorDto(id);
  }

  async publish(reviewerUserId: string, id: string): Promise<PixelObjectDto> {
    let revisionNumber = 0;
    await this.db.transaction(async (tx) => {
      const head = await this.lockHead(tx, id);
      const pending = await this.requirePendingRevision(tx, head);
      revisionNumber = pending.revisionNumber;
      await tx
        .update(pixelObjectRevisions)
        .set({
          status: 'published',
          rejectionComment: null,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          publishedAt: new Date(),
        })
        .where(eq(pixelObjectRevisions.id, pending.id));
      await tx
        .update(pixelObjects)
        .set({
          title: head.title,
          manifest: pending.manifest,
          sheetMediaId: pending.sheetMediaId,
          status: 'published',
          rejectionComment: null,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          revision: pending.revisionNumber,
          publishedRevisionId: pending.id,
          pendingRevisionId: null,
          updatedAt: new Date(),
        })
        .where(eq(pixelObjects.id, id));
    });
    await this.audit.write({
      actorUserId: reviewerUserId,
      action: 'pixel_object.publish',
      resource: 'pixel_object',
      resourceId: id,
      context: { revision: revisionNumber, decision: 'publish' },
    });
    const published = await this.getPublished(id);
    this.events.emit(domainEventNames.pixelObjectPublished, {
      pixelObjectId: published.id,
      revision: published.revision,
      mobile: toPixelObjectMobileDto({
        id: published.id,
        title: published.title,
        sheetUrl: published.sheetUrl,
        manifest: published.manifest,
        revision: published.revision,
        previewUrl: published.previewUrl ?? null,
      }),
    } satisfies PixelObjectPublishedEvent);
    return published;
  }

  async reject(reviewerUserId: string, id: string, comment: string): Promise<PixelObjectDto> {
    let revisionNumber = 0;
    await this.db.transaction(async (tx) => {
      const head = await this.lockHead(tx, id);
      const pending = await this.requirePendingRevision(tx, head);
      revisionNumber = pending.revisionNumber;
      await tx
        .update(pixelObjectRevisions)
        .set({
          status: 'rejected',
          rejectionComment: comment,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
        })
        .where(eq(pixelObjectRevisions.id, pending.id));
      const keepPublished = head.publishedRevisionId !== null;
      await tx
        .update(pixelObjects)
        .set({
          status: keepPublished ? 'published' : 'rejected',
          rejectionComment: keepPublished ? head.rejectionComment : comment,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          pendingRevisionId: keepPublished ? null : pending.id,
          updatedAt: new Date(),
        })
        .where(eq(pixelObjects.id, id));
    });
    await this.audit.write({
      actorUserId: reviewerUserId,
      action: 'pixel_object.reject',
      resource: 'pixel_object',
      resourceId: id,
      context: { revision: revisionNumber, decision: 'reject' },
    });
    const published = await this.findPublishedDto(id);
    if (published !== null) {
      return published;
    }
    return this.requireAuthorDto(id);
  }

  private mapRowsQuarantine(
    rows: Awaited<ReturnType<typeof selectPublishedJoined>>,
  ): PixelObjectDto[] {
    const items: PixelObjectDto[] = [];
    for (const row of rows) {
      const dto = toPixelObjectDto(row, this.storage, { quarantineCorrupt: true });
      if (dto === null) {
        this.logger.warn({ objectId: row.object.id }, 'pixel_object_quarantined_corrupt_manifest');
        continue;
      }
      items.push(dto);
    }
    return items;
  }

  private async findPublishedDto(id: string): Promise<PixelObjectDto | null> {
    try {
      return await this.getPublished(id);
    } catch {
      return null;
    }
  }

  private async requireAuthorDto(id: string): Promise<PixelObjectDto> {
    const rows = await selectAuthorJoined(this.db, eq(pixelObjects.id, id), 1);
    const dto = rows[0] ? toPixelObjectDto(rows[0], this.storage) : null;
    if (dto === null) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return dto;
  }

  private async insertPendingRevision(
    tx: Database,
    pixelObjectId: string,
    revisionNumber: number,
    input: SubmitPixelObjectDto,
    previewMediaId: string | null,
  ): Promise<string> {
    const contentHash = revisionContentHash(
      JSON.stringify(input.manifest),
      input.manifest.sheet.mediaId,
    );
    const [revision] = await tx
      .insert(pixelObjectRevisions)
      .values({
        pixelObjectId,
        revisionNumber,
        manifest: input.manifest,
        sheetMediaId: input.manifest.sheet.mediaId,
        previewMediaId,
        contentHash,
        status: 'pending',
      })
      .returning();
    if (revision === undefined) {
      throw new ValidationError('Не удалось сохранить ревизию');
    }
    return revision.id;
  }

  private async lockHead(tx: Database, id: string): Promise<PixelObjectRow> {
    const [head] = await tx.select().from(pixelObjects).where(eq(pixelObjects.id, id)).limit(1);
    if (head === undefined) {
      throw new NotFoundError('Объект не найден', { code: 'PIXEL_OBJECT_NOT_FOUND' });
    }
    return head;
  }

  private async requirePendingRevision(tx: Database, head: PixelObjectRow) {
    if (head.pendingRevisionId === null) {
      throw new ConflictError('Объект уже обработан', { code: 'PIXEL_OBJECT_ALREADY_REVIEWED' });
    }
    const [pending] = await tx
      .select()
      .from(pixelObjectRevisions)
      .where(
        and(
          eq(pixelObjectRevisions.id, head.pendingRevisionId),
          eq(pixelObjectRevisions.status, 'pending'),
        ),
      )
      .limit(1);
    if (pending === undefined) {
      throw new ConflictError('Объект уже обработан', { code: 'PIXEL_OBJECT_ALREADY_REVIEWED' });
    }
    return pending;
  }

  private async assertNoActivePending(existing: PixelObjectRow): Promise<void> {
    if (existing.pendingRevisionId === null) {
      return;
    }
    const [pending] = await this.db
      .select()
      .from(pixelObjectRevisions)
      .where(
        and(
          eq(pixelObjectRevisions.id, existing.pendingRevisionId),
          eq(pixelObjectRevisions.status, 'pending'),
        ),
      )
      .limit(1);
    if (pending !== undefined) {
      throw new ConflictError('Объект уже на модерации', { code: 'PIXEL_OBJECT_PENDING' });
    }
  }

  private async assertSheetOwned(
    authorUserId: string,
    manifest: PixelObjectManifest,
  ): Promise<Buffer> {
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

    const png = await this.storage.getObject(asset.storageKey, {
      maxBytes: this.limits.tpg.pixelObjectSheetMaxBytes,
    });
    await assertPixelObjectSheet(png, manifest, {
      maxFrames: this.limits.tpg.pixelObjectMaxFrames,
      maxBytes: this.limits.tpg.pixelObjectSheetMaxBytes,
    });
    return png;
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
}
