import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

export const appThemeStatusEnum = pgEnum('app_theme_status', ['pending', 'published', 'rejected']);

export const appThemes = pgTable(
  'app_themes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    colors: jsonb('colors').notNull(),
    sceneBackgroundColors: jsonb('scene_background_colors').notNull(),
    status: appThemeStatusEnum('status').notNull().default('pending'),
    rejectionComment: text('rejection_comment'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('app_themes_status_created_idx').on(table.status, table.createdAt),
    index('app_themes_author_idx').on(table.authorUserId, table.createdAt),
  ],
);
