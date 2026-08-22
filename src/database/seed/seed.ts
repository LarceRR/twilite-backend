import { randomBytes, scryptSync } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { loadConfig } from '@/config/env';
import * as schema from '@/database/schema';
import { defaultPermissionsForRole } from '@/modules/spaces/domain/value-objects/SpacePermission';
import type { Cell } from '@/modules/surface-objects/domain/value-objects/Cell';
import { knownKinds } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';
import { spawnNearExisting } from '@/modules/surfaces/domain/services/spawnNearExisting';
import { cryptoRandomSource } from '@/shared/utils/random';

const PASSWORD = 'twilite-dev-password';

const PEOPLE = [
  { email: 'anna@twilite.dev', displayName: 'Анна' },
  { email: 'ivan@twilite.dev', displayName: 'Иван' },
] as const;

const MOMENTS = [
  { kind: knownKinds.fire, state: 'Active', note: 'Приготовил завтрак без просьбы' },
  { kind: knownKinds.fire, state: 'Active', note: 'Забрал посылку по пути' },
  { kind: knownKinds.fire, state: 'Fading', note: 'Долго обнимал после тяжёлого дня' },
  { kind: knownKinds.cloud, state: 'Active', note: 'Резко ответил из-за усталости' },
  { kind: knownKinds.fire, state: 'Settled', note: 'Спонтанная прогулка вечером' },
  { kind: knownKinds.cloud, state: 'Fading', note: 'Забыл про договорённость' },
] as const;

/**
 * Development data only. It goes through the same domain rules as the API — the
 * spawn policy picks every cell — so a seeded surface looks like a used one.
 */
async function seed(): Promise<void> {
  const config = loadConfig();
  const client = postgres(config.database.url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const userIds: string[] = [];

    for (const person of PEOPLE) {
      const [user] = await db
        .insert(schema.users)
        .values(person)
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { displayName: person.displayName },
        })
        .returning();

      if (user === undefined) {
        throw new Error(`Не удалось создать пользователя ${person.email}`);
      }

      userIds.push(user.id);

      await db
        .insert(schema.userCredentials)
        .values({ userId: user.id, passwordHash: hashPassword(PASSWORD) })
        .onConflictDoNothing();

      await db.insert(schema.userPreferences).values({ userId: user.id }).onConflictDoNothing();
    }

    const [ownerId, partnerId] = userIds as [string, string];

    const [space] = await db
      .insert(schema.spaces)
      .values({ type: 'Shared', title: 'Мы вдвоём', ownerId })
      .returning();

    if (space === undefined) {
      throw new Error('Не удалось создать пространство');
    }

    await db
      .insert(schema.spaceMembers)
      .values([
        {
          spaceId: space.id,
          userId: ownerId,
          role: 'Owner',
          permissions: [...defaultPermissionsForRole('Owner')],
        },
        {
          spaceId: space.id,
          userId: partnerId,
          role: 'Member',
          permissions: [...defaultPermissionsForRole('Member')],
        },
      ])
      .onConflictDoNothing();

    const [surface] = await db.insert(schema.surfaces).values({ spaceId: space.id }).returning();

    if (surface === undefined) {
      throw new Error('Не удалось создать поверхность');
    }

    const occupied: Cell[] = [];

    for (const [index, moment] of MOMENTS.entries()) {
      const cell = spawnNearExisting({ occupied, radius: 2, random: cryptoRandomSource });
      occupied.push(cell);

      // Spread the history over the past days so the timeline is not one blob.
      const createdAt = new Date(Date.now() - (MOMENTS.length - index) * 86_400_000);
      const author = index % 2 === 0 ? partnerId : ownerId;
      const subject = author === ownerId ? partnerId : ownerId;

      const [object] = await db
        .insert(schema.surfaceObjects)
        .values({
          spaceId: space.id,
          surfaceId: surface.id,
          cellX: cell.x,
          cellY: cell.y,
          kind: moment.kind,
          state: moment.state,
          createdByUserId: author,
          subjectUserId: subject,
          metadata: { note: moment.note },
          favorite: index === 0,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();

      if (object === undefined) {
        continue;
      }

      await db.insert(schema.timelineEvents).values({
        spaceId: space.id,
        // Ровно то же значение, что пишет проекция в рантайме (TimelineEventType).
        type: 'SurfaceObjectCreated',
        actorUserId: author,
        subjectUserId: subject,
        payload: { objectId: object.id, kind: moment.kind, note: moment.note },
        createdAt,
      });
    }

    console.info(
      [
        'Данные для разработки готовы.',
        `Пространство: ${space.title} (${space.id})`,
        `Вход: ${PEOPLE[0].email} / ${PASSWORD}`,
      ].join('\n'),
    );
  } finally {
    await client.end();
  }
}

/** Mirrors PasswordService's format so a seeded account can actually sign in. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);

  return `scrypt1:${salt.toString('base64')}:${derived.toString('base64')}`;
}

seed().catch((error: unknown) => {
  console.error('Не удалось заполнить базу', error);
  process.exit(1);
});
