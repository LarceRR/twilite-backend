import { randomBytes, scryptSync } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { loadConfig } from '@/config/env';
import * as schema from '@/database/schema';

const PASSWORD = 'twilite-dev-password';

const ADMIN = {
  email: 'twilite@app.ru',
  displayName: 'Twilite',
} as const;

/**
 * Development data only: RBAC catalog and a single admin account.
 */
async function seed(): Promise<void> {
  const config = loadConfig();
  const client = postgres(config.database.url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [user] = await db
      .insert(schema.users)
      .values(ADMIN)
      .onConflictDoUpdate({
        target: schema.users.email,
        set: { displayName: ADMIN.displayName },
      })
      .returning();

    if (user === undefined) {
      throw new Error(`Не удалось создать пользователя ${ADMIN.email}`);
    }

    await db
      .insert(schema.userCredentials)
      .values({ userId: user.id, passwordHash: hashPassword(PASSWORD) })
      .onConflictDoNothing();

    await db.insert(schema.userPreferences).values({ userId: user.id }).onConflictDoNothing();

    const { RbacSeedService } = await import('@/modules/rbac/seed/rbacSeed.service');
    const { DrizzleRbacRepository } = await import(
      '@/modules/rbac/infrastructure/repositories/drizzleRbacRepository'
    );
    const rbacRepo = new DrizzleRbacRepository(db as never);
    await new RbacSeedService(rbacRepo).seed();

    const adminGroup = (await rbacRepo.listGroups()).find((group) => group.name === 'Admin');

    if (adminGroup === undefined) {
      throw new Error('Admin group missing after seed');
    }

    await rbacRepo.assignUserToGroup(user.id, adminGroup.id);

    console.info(
      [
        'Данные для разработки готовы.',
        `Админ: ${ADMIN.displayName} <${ADMIN.email}>`,
        `Вход: ${ADMIN.email} / ${PASSWORD}`,
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
