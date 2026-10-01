import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { mediaAssets } from './media';
import { users } from './users';

export const pixelObjectStatusEnum = pgEnum('pixel_object_status', [
  'pending',
  'published',
  'rejected',
]);

export const pixelObjects = pgTable(
  'pixel_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Dual-write head fields until P2-S2 cuts over reads to revisions. */
    manifest: jsonb('manifest').notNull(),
    sheetMediaId: uuid('sheet_media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    status: pixelObjectStatusEnum('status').notNull().default('pending'),
    rejectionComment: text('rejection_comment'),
    revision: integer('revision').notNull().default(1),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** Live published revision pointer (ADR-003). FK added in migration 0008. */
    publishedRevisionId: uuid('published_revision_id'),
    /** Current pending/rejected revision under review. FK added in migration 0008. */
    pendingRevisionId: uuid('pending_revision_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pixel_objects_status_created_idx').on(table.status, table.createdAt),
    index('pixel_objects_author_idx').on(table.authorUserId, table.updatedAt),
  ],
);
