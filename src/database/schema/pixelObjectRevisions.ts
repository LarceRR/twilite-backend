import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { mediaAssets } from './media';
import { pixelObjectStatusEnum, pixelObjects } from './pixelObjects';
import { users } from './users';

/**
 * Immutable revision rows (ADR-003). Head pointers live on `pixel_objects`
 * (`published_revision_id` / `pending_revision_id`) during the dual-write window.
 */
export const pixelObjectRevisions = pgTable(
  'pixel_object_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pixelObjectId: uuid('pixel_object_id')
      .notNull()
      .references(() => pixelObjects.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull(),
    manifest: jsonb('manifest').notNull(),
    sheetMediaId: uuid('sheet_media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    previewMediaId: uuid('preview_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    contentHash: text('content_hash').notNull(),
    status: pixelObjectStatusEnum('status').notNull().default('pending'),
    rejectionComment: text('rejection_comment'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('pixel_object_revisions_object_revision_uidx').on(
      table.pixelObjectId,
      table.revisionNumber,
    ),
    index('pixel_object_revisions_object_status_idx').on(table.pixelObjectId, table.status),
    index('pixel_object_revisions_sheet_media_idx').on(table.sheetMediaId),
  ],
);
