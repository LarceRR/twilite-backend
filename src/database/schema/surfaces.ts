import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { spaces } from './spaces';
import { users } from './users';

export const surfaces = pgTable(
  'surfaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  // Exactly one surface per space.
  (table) => [uniqueIndex('surfaces_space_unique').on(table.spaceId)],
);

export const surfaceObjects = pgTable(
  'surface_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    surfaceId: uuid('surface_id')
      .notNull()
      .references(() => surfaces.id, { onDelete: 'cascade' }),
    cellX: integer('cell_x').notNull(),
    cellY: integer('cell_y').notNull(),
    // Open registry, so a text column rather than a pg enum: adding a kind must
    // not require a migration.
    kind: text('kind').notNull(),
    state: text('state').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectUserId: uuid('subject_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default({}),
    favorite: boolean('favorite').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    // One object per cell — enforced by the database, not by application checks,
    // so concurrent creates cannot both take the same cell.
    uniqueIndex('surface_objects_cell_unique').on(table.surfaceId, table.cellX, table.cellY),
    index('surface_objects_surface_idx').on(table.surfaceId),
    index('surface_objects_space_idx').on(table.spaceId),
    // Drives the scheduled Fading -> Settled sweep.
    index('surface_objects_state_updated_idx').on(table.state, table.updatedAt),
  ],
);
