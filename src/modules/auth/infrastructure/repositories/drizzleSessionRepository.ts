import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { sessions } from '@/database/schema';
import { toUserId, type UserId } from '@/modules/users/domain/value-objects/UserId';
import { NotFoundError } from '@/shared/errors';

import type {
  CreateSessionInput,
  Session,
  SessionId,
  SessionRepository,
} from '../../domain/repositories/SessionRepository';

type SessionRow = typeof sessions.$inferSelect;

@Injectable()
export class DrizzleSessionRepository implements SessionRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        devicePlatform: input.device.platform,
        deviceModel: input.device.model,
        appVersion: input.device.appVersion,
        expiresAt: input.expiresAt,
      })
      .returning();

    return toSession(this.require(row));
  }

  async findById(id: SessionId): Promise<Session | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);

    return row === undefined ? null : toSession(row);
  }

  async listForUser(userId: UserId): Promise<readonly Session[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

    return rows.map(toSession);
  }

  async rotate(id: SessionId, refreshTokenHash: string, expiresAt: Date): Promise<Session> {
    const [row] = await this.db
      .update(sessions)
      .set({ refreshTokenHash, expiresAt, lastUsedAt: new Date() })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)))
      .returning();

    if (row === undefined) {
      throw new NotFoundError('Сессия не найдена или отозвана', { sessionId: id });
    }

    return toSession(row);
  }

  async revoke(id: SessionId): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
  }

  async revokeAllForUser(userId: UserId): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async deleteExpired(before: Date): Promise<number> {
    const rows = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, before))
      .returning({ id: sessions.id });

    return rows.length;
  }

  private require(row: SessionRow | undefined): SessionRow {
    if (row === undefined) {
      throw new NotFoundError('Не удалось создать сессию');
    }

    return row;
  }
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id as SessionId,
    userId: toUserId(row.userId),
    refreshTokenHash: row.refreshTokenHash,
    device: {
      platform: row.devicePlatform,
      model: row.deviceModel,
      appVersion: row.appVersion,
    },
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
