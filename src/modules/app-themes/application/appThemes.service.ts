import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { appThemes, users } from '@/database/schema';
import type { AppThemeDto, SubmitAppThemeDto } from '@/shared/contracts/appThemes.contract';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors';

import { assertThemePendingForReview } from './assertThemePendingForReview';

type ThemeStatus = 'pending' | 'published' | 'rejected';

type ThemeRow = typeof appThemes.$inferSelect;

@Injectable()
export class AppThemesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listPublished(limit = 50): Promise<AppThemeDto[]> {
    const rows = await this.db
      .select({
        theme: appThemes,
        authorDisplayName: users.displayName,
      })
      .from(appThemes)
      .innerJoin(users, eq(users.id, appThemes.authorUserId))
      .where(eq(appThemes.status, 'published'))
      .orderBy(desc(appThemes.createdAt))
      .limit(limit);

    return rows.map((row) => toDto(row.theme, row.authorDisplayName));
  }

  async getPublished(id: string): Promise<AppThemeDto> {
    const row = await this.findWithAuthor(id);
    if (row === null || row.theme.status !== 'published') {
      throw new NotFoundError('Тема не найдена', { code: 'THEME_NOT_FOUND' });
    }
    return toDto(row.theme, row.authorDisplayName);
  }

  async listMine(authorUserId: string): Promise<AppThemeDto[]> {
    const rows = await this.db
      .select({
        theme: appThemes,
        authorDisplayName: users.displayName,
      })
      .from(appThemes)
      .innerJoin(users, eq(users.id, appThemes.authorUserId))
      .where(eq(appThemes.authorUserId, authorUserId))
      .orderBy(desc(appThemes.updatedAt));

    return rows.map((row) => toDto(row.theme, row.authorDisplayName));
  }

  async listPending(): Promise<AppThemeDto[]> {
    const rows = await this.db
      .select({
        theme: appThemes,
        authorDisplayName: users.displayName,
      })
      .from(appThemes)
      .innerJoin(users, eq(users.id, appThemes.authorUserId))
      .where(eq(appThemes.status, 'pending'))
      .orderBy(desc(appThemes.createdAt));

    return rows.map((row) => toDto(row.theme, row.authorDisplayName));
  }

  async submit(authorUserId: string, input: SubmitAppThemeDto): Promise<AppThemeDto> {
    const [row] = await this.db
      .insert(appThemes)
      .values({
        authorUserId,
        name: input.name,
        description: input.description,
        colors: input.colors,
        sceneBackgroundColors: input.sceneBackgroundColors,
        status: 'pending',
      })
      .returning();

    if (row === undefined) {
      throw new ValidationError('Не удалось сохранить тему');
    }

    const author = await this.displayName(authorUserId);
    return toDto(row, author);
  }

  async resubmit(
    authorUserId: string,
    id: string,
    input: SubmitAppThemeDto,
  ): Promise<AppThemeDto> {
    const existing = await this.requireOwned(id, authorUserId);
    if (existing.status !== 'rejected') {
      throw new ConflictError('Редактировать можно только отклонённую тему', {
        code: 'THEME_NOT_PENDING',
      });
    }

    const [row] = await this.db
      .update(appThemes)
      .set({
        name: input.name,
        description: input.description,
        colors: input.colors,
        sceneBackgroundColors: input.sceneBackgroundColors,
        status: 'pending',
        rejectionComment: null,
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(appThemes.id, id), eq(appThemes.authorUserId, authorUserId)))
      .returning();

    if (row === undefined) {
      throw new NotFoundError('Тема не найдена', { code: 'THEME_NOT_FOUND' });
    }

    const author = await this.displayName(authorUserId);
    return toDto(row, author);
  }

  async deleteOwned(authorUserId: string, id: string): Promise<void> {
    const existing = await this.requireOwned(id, authorUserId);
    if (existing.status === 'published') {
      throw new AuthorizationError('Опубликованную тему нельзя удалить', {
        code: 'THEME_FORBIDDEN',
      });
    }

    await this.db
      .delete(appThemes)
      .where(and(eq(appThemes.id, id), eq(appThemes.authorUserId, authorUserId)));
  }

  async publish(reviewerUserId: string, id: string): Promise<AppThemeDto> {
    return this.review(id, reviewerUserId, 'published', null);
  }

  async reject(reviewerUserId: string, id: string, comment: string): Promise<AppThemeDto> {
    return this.review(id, reviewerUserId, 'rejected', comment);
  }

  private async review(
    id: string,
    reviewerUserId: string,
    status: Extract<ThemeStatus, 'published' | 'rejected'>,
    comment: string | null,
  ): Promise<AppThemeDto> {
    const found = await this.findWithAuthor(id);
    if (found === null) {
      throw new NotFoundError('Тема не найдена', { code: 'THEME_NOT_FOUND' });
    }
    assertThemePendingForReview(found.theme);

    const [row] = await this.db
      .update(appThemes)
      .set({
        status,
        rejectionComment: status === 'rejected' ? comment : null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(appThemes.id, id), eq(appThemes.status, 'pending')))
      .returning();

    if (row === undefined) {
      throw new ConflictError('Тема уже обработана', { code: 'THEME_ALREADY_REVIEWED' });
    }

    return toDto(row, found.authorDisplayName);
  }

  private async requireOwned(id: string, authorUserId: string): Promise<ThemeRow> {
    const [row] = await this.db.select().from(appThemes).where(eq(appThemes.id, id)).limit(1);
    if (row === undefined) {
      throw new NotFoundError('Тема не найдена', { code: 'THEME_NOT_FOUND' });
    }
    if (row.authorUserId !== authorUserId) {
      throw new AuthorizationError('Нет доступа к теме', { code: 'THEME_FORBIDDEN' });
    }
    return row;
  }

  private async findWithAuthor(
    id: string,
  ): Promise<{ theme: ThemeRow; authorDisplayName: string } | null> {
    const [row] = await this.db
      .select({
        theme: appThemes,
        authorDisplayName: users.displayName,
      })
      .from(appThemes)
      .innerJoin(users, eq(users.id, appThemes.authorUserId))
      .where(eq(appThemes.id, id))
      .limit(1);

    return row ?? null;
  }

  private async displayName(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.displayName ?? 'Unknown';
  }
}

function toDto(theme: ThemeRow, authorDisplayName: string): AppThemeDto {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    authorDisplayName,
    authorUserId: theme.authorUserId,
    status: theme.status,
    rejectionComment: theme.rejectionComment,
    colors: theme.colors as AppThemeDto['colors'],
    sceneBackgroundColors: theme.sceneBackgroundColors as AppThemeDto['sceneBackgroundColors'],
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
    reviewedAt: theme.reviewedAt?.toISOString() ?? null,
  };
}
