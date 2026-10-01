import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users';

export const userPermissionTypeEnum = pgEnum('user_permission_type', ['GRANT', 'DENY']);

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionRu: text('description_ru').notNull(),
    module: text('module').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('permissions_name_unique').on(table.name)],
);

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionRu: text('description_ru').notNull(),
    parentGroupId: uuid('parent_group_id'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('groups_name_unique').on(table.name),
    index('groups_parent_idx').on(table.parentGroupId),
  ],
);

export const groupPermissions = pgTable(
  'group_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('group_permissions_unique').on(table.groupId, table.permissionId),
    index('group_permissions_group_idx').on(table.groupId),
    index('group_permissions_permission_idx').on(table.permissionId),
  ],
);

export const userGroups = pgTable(
  'user_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('user_groups_unique').on(table.userId, table.groupId),
    index('user_groups_user_idx').on(table.userId),
    index('user_groups_group_idx').on(table.groupId),
  ],
);

export const userPermissions = pgTable(
  'user_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    type: userPermissionTypeEnum('type').notNull(),
  },
  (table) => [
    uniqueIndex('user_permissions_unique').on(table.userId, table.permissionId),
    index('user_permissions_user_idx').on(table.userId),
    index('user_permissions_permission_idx').on(table.permissionId),
  ],
);
