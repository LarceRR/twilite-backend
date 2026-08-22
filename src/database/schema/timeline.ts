import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { spaces } from './spaces';
import { users } from './users';

export const timelineEvents = pgTable(
  'timeline_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // A monotonic sequence gives stable keyset pagination even when several
    // events share a timestamp.
    sequence: bigserial('sequence', { mode: 'number' }).notNull(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    subjectUserId: uuid('subject_user_id').references(() => users.id, { onDelete: 'set null' }),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('timeline_space_sequence_idx').on(table.spaceId, table.sequence),
    index('timeline_space_type_idx').on(table.spaceId, table.type),
  ],
);
