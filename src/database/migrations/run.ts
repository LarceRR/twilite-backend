import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { loadConfig } from '@/config/env';

/**
 * Migrations run as their own step in deploys (never on boot), so several API
 * instances can start in parallel without racing on schema changes.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const client = postgres(config.database.url, { max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder: 'src/database/migrations' });
    console.warn('Миграции применены');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Не удалось применить миграции', error);
  process.exit(1);
});
