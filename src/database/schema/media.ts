import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { spaces } from './spaces';
import { users } from './users';

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull().default(0),
    // Uploads go straight to object storage, so a row is 'pending' until confirmed.
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [index('media_owner_idx').on(table.ownerId)],
);
