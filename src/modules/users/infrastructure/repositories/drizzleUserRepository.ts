import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { userCredentials, userPreferences, users } from '@/database/schema';
import { InfrastructureError, NotFoundError } from '@/shared/errors';

import {
  defaultPreferences,
  type User,
  type UserCredentials,
  type UserPreferences,
} from '../../domain/entities/User';
import type { CreateUserInput, UserRepository } from '../../domain/repositories/UserRepository';
import type { Email } from '../../domain/value-objects/Email';
import { toUserId, type UserId } from '../../domain/value-objects/UserId';

type UserRow = typeof users.$inferSelect;
type PreferencesRow = typeof userPreferences.$inferSelect;

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: UserId): Promise<User | null> {
    const rows = await this.db
      .select({ user: users, preferences: userPreferences })
      .from(users)
      .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);

    const row = rows[0];

    return row === undefined ? null : toUser(row.user, row.preferences);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db
      .select({ user: users, preferences: userPreferences })
      .from(users)
      .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];

    return row === undefined ? null : toUser(row.user, row.preferences);
  }

  async findCredentialsByEmail(email: Email): Promise<UserCredentials | null> {
    const rows = await this.db
      .select({ userId: userCredentials.userId, passwordHash: userCredentials.passwordHash })
      .from(userCredentials)
      .innerJoin(users, eq(users.id, userCredentials.userId))
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];

    return row === undefined
      ? null
      : { userId: toUserId(row.userId), passwordHash: row.passwordHash };
  }

  /** User, credentials and preferences are created together or not at all. */
  async create(input: CreateUserInput): Promise<User> {
    return this.db.transaction(async (tx) => {
      const [userRow] = await tx
        .insert(users)
        .values({ email: input.email, displayName: input.displayName })
        .returning();

      if (userRow === undefined) {
        throw new InfrastructureError('Не удалось создать пользователя');
      }

      await tx
        .insert(userCredentials)
        .values({ userId: userRow.id, passwordHash: input.passwordHash });

      const [preferencesRow] = await tx
        .insert(userPreferences)
        .values({ userId: userRow.id })
        .returning();

      return toUser(userRow, preferencesRow ?? null);
    });
  }

  async updateProfile(
    id: UserId,
    patch: { readonly displayName?: string; readonly avatarUrl?: string | null },
  ): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({
        ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
        ...(patch.avatarUrl === undefined ? {} : { avatarUrl: patch.avatarUrl }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (row === undefined) {
      throw new NotFoundError('Пользователь не найден', { userId: id });
    }

    const user = await this.findById(id);

    return user ?? toUser(row, null);
  }

  async updatePreferences(id: UserId, preferences: UserPreferences): Promise<User> {
    await this.db
      .insert(userPreferences)
      .values({ userId: id, ...preferences })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { ...preferences } });

    const user = await this.findById(id);

    if (user === null) {
      throw new NotFoundError('Пользователь не найден', { userId: id });
    }

    return user;
  }
}

function toUser(row: UserRow, preferences: PreferencesRow | null): User {
  return {
    id: toUserId(row.id),
    email: row.email as Email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    preferences:
      preferences === null
        ? defaultPreferences
        : {
            locale: preferences.locale,
            soundEnabled: preferences.soundEnabled,
            hapticsEnabled: preferences.hapticsEnabled,
            reduceMotion: preferences.reduceMotion,
            pushEnabled: preferences.pushEnabled,
          },
  };
}
