import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Logger } from 'nestjs-pino';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import {
  mediaAssets,
  pixelObjectRevisions,
  pixelObjects,
  tpgProjects,
  users,
} from '@/database/schema';
import {
  IMMUTABLE_OBJECT_CACHE_CONTROL,
  STORAGE,
  type StoragePort,
} from '@/infrastructure/storage/StoragePort';
import { buildOpaqueStorageKey } from '@/modules/media/domain/opaqueStorageKey';
import {
  type CatalogListQuery,
  decodeCatalogCursor,
  encodeCatalogCursor,
} from '@/modules/tpg-pixel-objects/application/catalogCursor';
import {
  authorCursorWhere,
  selectAuthorJoined,
  toPixelObjectDto,
} from '@/modules/tpg-pixel-objects/application/pixelObjectQueries';
import type { UploadTicketDto } from '@/shared/contracts/media.contract';
import type { PixelObjectDto } from '@/shared/contracts/pixelObjects.contract';
import type {
  CreateProjectAvatarUploadDto,
  CreateProjectDto,
  ProjectDto,
  ProjectLimits,
  ReassignProjectDto,
  UpdateProjectDto,
} from '@/shared/contracts/projects.contract';
import { TWILITE_SYSTEM_USER_EMAIL } from '@/shared/constants/twiliteSystemUser';
import {
  AuthorizationError,
  ConflictError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';

type ProjectRow = typeof tpgProjects.$inferSelect;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(LIMITS) private readonly limits: AppLimits,
    private readonly logger: Logger,
    private readonly idempotency: IdempotencyService,
  ) {}

  getLimits(): ProjectLimits {
    return {
      projectsPerUser: this.limits.tpg.projectsPerUser,
      objectsPerProject: this.limits.tpg.objectsPerProject,
      titleMax: this.limits.tpg.projectTitleMaxLength,
    };
  }

  async create(
    ownerUserId: string,
    input: CreateProjectDto,
    idempotencyKey?: string | null,
  ): Promise<ProjectDto> {
    return this.idempotency.execute({
      key: idempotencyKey,
      scope: `tpg-project:create:${ownerUserId}`,
      payload: input,
      operation: () => this.createOnce(ownerUserId, input),
    });
  }

  async listMine(ownerUserId: string): Promise<{ items: ProjectDto[] }> {
    const rows = await this.db
      .select({
        project: tpgProjects,
        ownerDisplayName: users.displayName,
        objectCount: sql<number>`(
          select count(*)::int from ${pixelObjects}
          where ${pixelObjects.projectId} = ${tpgProjects.id}
        )`,
        avatarStorageKey: mediaAssets.storageKey,
      })
      .from(tpgProjects)
      .innerJoin(users, eq(users.id, tpgProjects.ownerId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, tpgProjects.avatarMediaId))
      .where(eq(tpgProjects.ownerId, ownerUserId))
      .orderBy(desc(tpgProjects.updatedAt), desc(tpgProjects.id));

    const items: ProjectDto[] = [];
    for (const row of rows) {
      items.push(
        await this.toDto({
          project: row.project,
          ownerDisplayName: row.ownerDisplayName,
          objectCount: Number(row.objectCount),
          avatarStorageKey: row.avatarStorageKey,
        }),
      );
    }
    return { items };
  }

  async getById(actorUserId: string, projectId: string): Promise<ProjectDto> {
    await this.requireOwned(projectId, actorUserId);
    return this.requireDto(projectId);
  }

  async listObjects(
    actorUserId: string,
    projectId: string,
    query: CatalogListQuery = { limit: 20 },
  ): Promise<{ items: PixelObjectDto[]; nextCursor: string | null }> {
    await this.requireOwned(projectId, actorUserId);
    const cursor = query.cursor ? decodeCatalogCursor(query.cursor) : null;
    if (query.cursor && cursor === null) {
      throw new ValidationError('Некорректный cursor', [
        { path: 'cursor', message: 'Ожидается opaque catalog cursor' },
      ]);
    }
    const filter =
      cursor === null
        ? eq(pixelObjects.projectId, projectId)
        : and(eq(pixelObjects.projectId, projectId), authorCursorWhere(cursor));
    if (filter === undefined) {
      throw new Error('listObjects: empty SQL expression');
    }
    const rows = await selectAuthorJoined(this.db, filter, query.limit + 1);
    const page = rows.slice(0, query.limit);
    const items: PixelObjectDto[] = [];
    for (const row of page) {
      const dto = toPixelObjectDto(row, this.storage);
      if (dto !== null) {
        items.push(dto);
      }
    }
    const last = page.at(-1);
    const nextCursor =
      rows.length > query.limit && last?.sortAt != null
        ? encodeCatalogCursor({
            id: last.object.id,
            publishedAt:
              last.sortAt instanceof Date ? last.sortAt.toISOString() : String(last.sortAt),
          })
        : null;
    return { items, nextCursor };
  }

  async update(actorUserId: string, projectId: string, input: UpdateProjectDto): Promise<ProjectDto> {
    const project = await this.requireOwned(projectId, actorUserId);
    const titleMax = this.limits.tpg.projectTitleMaxLength;
    if (input.title !== undefined && input.title.length > titleMax) {
      throw new ValidationError('Название слишком длинное', [
        { path: 'title', message: `Максимум ${titleMax} символов` },
      ]);
    }

    const patch: Partial<ProjectRow> = { updatedAt: new Date() };
    if (input.title !== undefined) {
      patch.title = input.title;
    }
    if (input.description !== undefined) {
      patch.description = input.description;
    }
    if (input.clearAvatar === true) {
      patch.avatarMediaId = null;
    }

    await this.db.update(tpgProjects).set(patch).where(eq(tpgProjects.id, project.id));
    return this.requireDto(projectId);
  }

  async createAvatarUpload(
    actorUserId: string,
    projectId: string,
    body: CreateProjectAvatarUploadDto,
  ): Promise<UploadTicketDto> {
    await this.requireOwned(projectId, actorUserId);
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

    const storageKey = buildOpaqueStorageKey('project-avatar');
    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        ownerId: actorUserId,
        kind: 'project-avatar',
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

  async confirmAvatar(
    actorUserId: string,
    projectId: string,
    assetId: string,
  ): Promise<ProjectDto> {
    const project = await this.requireOwned(projectId, actorUserId);
    if (!this.storage.enabled) {
      throw new InfrastructureError('Загрузка файлов недоступна: хранилище не настроено');
    }

    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, actorUserId),
          eq(mediaAssets.kind, 'project-avatar'),
        ),
      )
      .limit(1);

    if (asset === undefined) {
      throw new NotFoundError('Файл аватара не найден', { assetId });
    }

    const publicUrl = this.storage.publicUrl(asset.storageKey);
    if (publicUrl === null) {
      throw new InfrastructureError(
        'STORAGE_PUBLIC_URL не настроен — публичный URL аватара недоступен',
      );
    }

    if (asset.status !== 'ready' || asset.confirmedAt === null) {
      await this.db
        .update(mediaAssets)
        .set({ status: 'ready', confirmedAt: new Date() })
        .where(eq(mediaAssets.id, assetId));
    }

    const previousAvatarId = project.avatarMediaId;
    await this.db
      .update(tpgProjects)
      .set({ avatarMediaId: assetId, updatedAt: new Date() })
      .where(eq(tpgProjects.id, projectId));

    if (previousAvatarId !== null && previousAvatarId !== assetId) {
      await this.deleteAvatarAsset(previousAvatarId);
    }

    return this.requireDto(projectId);
  }

  async reassign(
    actorUserId: string,
    projectId: string,
    input: ReassignProjectDto,
  ): Promise<ProjectDto> {
    await this.requireOwned(projectId, actorUserId);
    if (input.toUserId === actorUserId) {
      return this.requireDto(projectId);
    }
    await this.transferOwnership(projectId, input.toUserId);
    // After transfer actor is no longer owner — return DTO for new owner view is still valid.
    return this.requireDto(projectId);
  }

  async softDelete(actorUserId: string, projectId: string): Promise<ProjectDto> {
    await this.requireOwned(projectId, actorUserId);
    const twiliteUserId = await this.requireTwiliteSystemUserId();
    if (actorUserId === twiliteUserId) {
      throw new ConflictError('Системный пользователь не может удалить проект');
    }
    await this.transferOwnership(projectId, twiliteUserId);
    return this.requireDto(projectId);
  }

  /** Used by pixel-objects submit to enforce ownership + capacity. */
  async assertWritableProject(ownerUserId: string, projectId: string): Promise<ProjectRow> {
    const project = await this.requireOwned(projectId, ownerUserId);
    const [row] = await this.db
      .select({ value: count() })
      .from(pixelObjects)
      .where(eq(pixelObjects.projectId, projectId));
    const objectCount = Number(row?.value ?? 0);
    if (objectCount >= this.limits.tpg.objectsPerProject) {
      throw new ConflictError('В проекте слишком много объектов', {
        code: 'PROJECT_OBJECT_LIMIT',
        limit: this.limits.tpg.objectsPerProject,
      });
    }
    return project;
  }

  async requireOwnedProject(ownerUserId: string, projectId: string): Promise<ProjectRow> {
    return this.requireOwned(projectId, ownerUserId);
  }

  async requireProjectRow(projectId: string): Promise<ProjectRow> {
    return this.requireProject(projectId);
  }

  private async createOnce(ownerUserId: string, input: CreateProjectDto): Promise<ProjectDto> {
    const titleMax = this.limits.tpg.projectTitleMaxLength;
    if (input.title.length > titleMax) {
      throw new ValidationError('Название слишком длинное', [
        { path: 'title', message: `Максимум ${titleMax} символов` },
      ]);
    }

    const [owned] = await this.db
      .select({ value: count() })
      .from(tpgProjects)
      .where(eq(tpgProjects.ownerId, ownerUserId));
    if (Number(owned?.value ?? 0) >= this.limits.tpg.projectsPerUser) {
      throw new ConflictError('Слишком много проектов', {
        code: 'PROJECT_OWNER_LIMIT',
        limit: this.limits.tpg.projectsPerUser,
      });
    }

    const [created] = await this.db
      .insert(tpgProjects)
      .values({
        ownerId: ownerUserId,
        title: input.title,
        description: input.description ?? '',
      })
      .returning();

    if (created === undefined) {
      throw new ValidationError('Не удалось создать проект');
    }
    return this.requireDto(created.id);
  }

  private async transferOwnership(projectId: string, toUserId: string): Promise<void> {
    const [target] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, toUserId)).limit(1);
    if (target === undefined) {
      throw new NotFoundError('Пользователь не найден', { userId: toUserId });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(tpgProjects)
        .set({ ownerId: toUserId, updatedAt: new Date() })
        .where(eq(tpgProjects.id, projectId));
      await tx
        .update(pixelObjects)
        .set({ authorUserId: toUserId, updatedAt: new Date() })
        .where(eq(pixelObjects.projectId, projectId));
    });
  }

  private async requireTwiliteSystemUserId(): Promise<string> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TWILITE_SYSTEM_USER_EMAIL))
      .limit(1);
    if (user === undefined) {
      throw new InfrastructureError(
        `Системный пользователь ${TWILITE_SYSTEM_USER_EMAIL} не найден — выполните seed`,
      );
    }
    return user.id;
  }

  private async requireOwned(projectId: string, ownerUserId: string): Promise<ProjectRow> {
    const project = await this.requireProject(projectId);
    if (project.ownerId !== ownerUserId) {
      throw new AuthorizationError('Нет доступа к проекту', { code: 'PROJECT_FORBIDDEN' });
    }
    return project;
  }

  private async requireProject(projectId: string): Promise<ProjectRow> {
    const [project] = await this.db
      .select()
      .from(tpgProjects)
      .where(eq(tpgProjects.id, projectId))
      .limit(1);
    if (project === undefined) {
      throw new NotFoundError('Проект не найден', { code: 'PROJECT_NOT_FOUND' });
    }
    return project;
  }

  private async requireDto(projectId: string): Promise<ProjectDto> {
    const avatarMedia = alias(mediaAssets, 'project_avatar_media');
    const [row] = await this.db
      .select({
        project: tpgProjects,
        ownerDisplayName: users.displayName,
        objectCount: sql<number>`(
          select count(*)::int from ${pixelObjects}
          where ${pixelObjects.projectId} = ${tpgProjects.id}
        )`,
        avatarStorageKey: avatarMedia.storageKey,
      })
      .from(tpgProjects)
      .innerJoin(users, eq(users.id, tpgProjects.ownerId))
      .leftJoin(avatarMedia, eq(avatarMedia.id, tpgProjects.avatarMediaId))
      .where(eq(tpgProjects.id, projectId))
      .limit(1);

    if (row === undefined) {
      throw new NotFoundError('Проект не найден', { code: 'PROJECT_NOT_FOUND' });
    }

    return this.toDto({
      project: row.project,
      ownerDisplayName: row.ownerDisplayName,
      objectCount: Number(row.objectCount),
      avatarStorageKey: row.avatarStorageKey,
    });
  }

  private async toDto(input: {
    readonly project: ProjectRow;
    readonly ownerDisplayName: string;
    readonly objectCount: number;
    readonly avatarStorageKey: string | null;
  }): Promise<ProjectDto> {
    const avatarUrl = await this.resolveAvatarUrl(
      input.project,
      input.avatarStorageKey,
    );
    return {
      id: input.project.id,
      title: input.project.title,
      description: input.project.description,
      ownerUserId: input.project.ownerId,
      ownerDisplayName: input.ownerDisplayName,
      avatarUrl,
      objectCount: input.objectCount,
      createdAt: input.project.createdAt.toISOString(),
      updatedAt: input.project.updatedAt.toISOString(),
    };
  }

  private async resolveAvatarUrl(
    project: ProjectRow,
    avatarStorageKey: string | null,
  ): Promise<string | null> {
    if (avatarStorageKey !== null && avatarStorageKey.length > 0) {
      return this.storage.publicUrl(avatarStorageKey);
    }

    const previewMedia = alias(mediaAssets, 'last_object_preview');
    const [last] = await this.db
      .select({
        previewStorageKey: previewMedia.storageKey,
      })
      .from(pixelObjects)
      .leftJoin(
        pixelObjectRevisions,
        eq(
          pixelObjectRevisions.id,
          sql`coalesce(${pixelObjects.pendingRevisionId}, ${pixelObjects.publishedRevisionId})`,
        ),
      )
      .leftJoin(previewMedia, eq(previewMedia.id, pixelObjectRevisions.previewMediaId))
      .where(eq(pixelObjects.projectId, project.id))
      .orderBy(desc(pixelObjects.createdAt), desc(pixelObjects.id))
      .limit(1);

    if (last?.previewStorageKey == null || last.previewStorageKey.length === 0) {
      return null;
    }
    return this.storage.publicUrl(last.previewStorageKey);
  }

  private async deleteAvatarAsset(assetId: string): Promise<void> {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);
    if (asset === undefined) {
      return;
    }
    try {
      await this.storage.delete(asset.storageKey);
    } catch (error) {
      this.logger.warn({ err: error, assetId }, 'Не удалось удалить предыдущий аватар проекта');
    }
  }
}
