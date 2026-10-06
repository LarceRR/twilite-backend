import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { mediaAssets } from './media';
import { users } from './users';

/**
 * Artist-owned container for TPG pixel objects (not social spaces).
 * Soft-delete = reassign owner to the Twilite system user.
 */
export const tpgProjects = pgTable(
  'tpg_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    avatarMediaId: uuid('avatar_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tpg_projects_owner_updated_idx').on(table.ownerId, table.updatedAt)],
);
