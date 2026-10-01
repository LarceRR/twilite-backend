import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import {
  groupPermissions,
  groups,
  permissions,
  userGroups,
  userPermissions,
  users,
} from '@/database/schema';

import type {
  RbacGroup,
  RbacPermission,
  RbacRepository,
  UserPermissionOverride,
  UserPermissionOverrideType,
} from '../../domain/repositories/RbacRepository';

@Injectable()
export class DrizzleRbacRepository implements RbacRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listPermissions(): Promise<RbacPermission[]> {
    const rows = await this.db.select().from(permissions).orderBy(permissions.name);
    return rows.map(toPermission);
  }

  async findPermissionById(id: string): Promise<RbacPermission | null> {
    const [row] = await this.db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    return row === undefined ? null : toPermission(row);
  }

  async findPermissionByName(name: string): Promise<RbacPermission | null> {
    const [row] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.name, name))
      .limit(1);
    return row === undefined ? null : toPermission(row);
  }

  async listGroups(): Promise<RbacGroup[]> {
    const rows = await this.db.select().from(groups).orderBy(groups.name);
    return rows.map(toGroup);
  }

  async findGroupById(id: string): Promise<RbacGroup | null> {
    const [row] = await this.db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return row === undefined ? null : toGroup(row);
  }

  async findDefaultGroup(): Promise<RbacGroup | null> {
    const [row] = await this.db
      .select()
      .from(groups)
      .where(eq(groups.isDefault, true))
      .limit(1);
    return row === undefined ? null : toGroup(row);
  }

  async updateGroup(
    id: string,
    input: {
      readonly name?: string;
      readonly descriptionEn?: string;
      readonly descriptionRu?: string;
      readonly parentGroupId?: string | null;
    },
  ): Promise<RbacGroup> {
    const [row] = await this.db
      .update(groups)
      .set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.descriptionEn === undefined ? {} : { descriptionEn: input.descriptionEn }),
        ...(input.descriptionRu === undefined ? {} : { descriptionRu: input.descriptionRu }),
        ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
        updatedAt: new Date(),
      })
      .where(eq(groups.id, id))
      .returning();

    if (row === undefined) {
      throw new Error(`Group ${id} not found`);
    }

    return toGroup(row);
  }

  async replaceGroupPermissions(groupId: string, permissionIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(groupPermissions).where(eq(groupPermissions.groupId, groupId));

      if (permissionIds.length === 0) {
        return;
      }

      await tx.insert(groupPermissions).values(
        permissionIds.map((permissionId) => ({
          groupId,
          permissionId,
        })),
      );
    });
  }

  async listGroupPermissionIds(groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ permissionId: groupPermissions.permissionId })
      .from(groupPermissions)
      .where(eq(groupPermissions.groupId, groupId));

    return rows.map((row) => row.permissionId);
  }

  async listGroupPermissionNames(groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: permissions.name })
      .from(groupPermissions)
      .innerJoin(permissions, eq(groupPermissions.permissionId, permissions.id))
      .where(eq(groupPermissions.groupId, groupId));

    return rows.map((row) => row.name);
  }

  async listUserGroupIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(eq(userGroups.userId, userId));

    return rows.map((row) => row.groupId);
  }

  async listUserGroups(userId: string): Promise<RbacGroup[]> {
    const rows = await this.db
      .select({ group: groups })
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, userId));

    return rows.map((row) => toGroup(row.group));
  }

  async assignUserToGroup(userId: string, groupId: string): Promise<void> {
    await this.db.insert(userGroups).values({ userId, groupId }).onConflictDoNothing();
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    await this.db
      .delete(userGroups)
      .where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)));
  }

  async listUserIdsInGroups(groupIds: readonly string[]): Promise<string[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({ userId: userGroups.userId })
      .from(userGroups)
      .where(inArray(userGroups.groupId, [...groupIds]));

    return [...new Set(rows.map((row) => row.userId))];
  }

  async listUserOverrides(userId: string): Promise<UserPermissionOverride[]> {
    const rows = await this.db
      .select({
        permissionId: userPermissions.permissionId,
        type: userPermissions.type,
        name: permissions.name,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    return rows.map((row) => ({
      permissionId: row.permissionId,
      permissionName: row.name,
      type: row.type as UserPermissionOverrideType,
    }));
  }

  async setUserOverrides(
    userId: string,
    overrides: readonly {
      readonly permissionId: string;
      readonly type: UserPermissionOverrideType;
    }[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));

      if (overrides.length === 0) {
        return;
      }

      await tx.insert(userPermissions).values(
        overrides.map((override) => ({
          userId,
          permissionId: override.permissionId,
          type: override.type,
        })),
      );
    });
  }

  async listUserIdsWithPermissionAssignment(permissionId: string): Promise<string[]> {
    const fromGroups = await this.db
      .select({ userId: userGroups.userId })
      .from(groupPermissions)
      .innerJoin(userGroups, eq(groupPermissions.groupId, userGroups.groupId))
      .where(eq(groupPermissions.permissionId, permissionId));

    const fromOverrides = await this.db
      .select({ userId: userPermissions.userId })
      .from(userPermissions)
      .where(eq(userPermissions.permissionId, permissionId));

    return [
      ...new Set([
        ...fromGroups.map((row) => row.userId),
        ...fromOverrides.map((row) => row.userId),
      ]),
    ];
  }

  async loadGroupParentMap(): Promise<Map<string, string | null>> {
    const rows = await this.db
      .select({ id: groups.id, parentGroupId: groups.parentGroupId })
      .from(groups);
    return new Map(rows.map((row) => [row.id, row.parentGroupId]));
  }

  async loadGroupChildrenMap(): Promise<Map<string, string[]>> {
    const rows = await this.db
      .select({ id: groups.id, parentGroupId: groups.parentGroupId })
      .from(groups);
    const map = new Map<string, string[]>();

    for (const row of rows) {
      if (row.parentGroupId === null) {
        continue;
      }

      const list = map.get(row.parentGroupId) ?? [];
      list.push(row.id);
      map.set(row.parentGroupId, list);
    }

    return map;
  }

  async upsertPermission(entry: {
    readonly name: string;
    readonly descriptionEn: string;
    readonly descriptionRu: string;
    readonly module: string;
  }): Promise<RbacPermission> {
    const [row] = await this.db
      .insert(permissions)
      .values({
        name: entry.name,
        descriptionEn: entry.descriptionEn,
        descriptionRu: entry.descriptionRu,
        module: entry.module,
      })
      .onConflictDoUpdate({
        target: permissions.name,
        set: {
          descriptionEn: entry.descriptionEn,
          descriptionRu: entry.descriptionRu,
          module: entry.module,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error(`Failed to upsert permission ${entry.name}`);
    }

    return toPermission(row);
  }

  async upsertGroup(entry: {
    readonly name: string;
    readonly descriptionEn: string;
    readonly descriptionRu: string;
    readonly parentGroupId: string | null;
    readonly isDefault: boolean;
  }): Promise<RbacGroup> {
    const existing = await this.db
      .select()
      .from(groups)
      .where(eq(groups.name, entry.name))
      .limit(1);

    if (existing[0] !== undefined) {
      const [row] = await this.db
        .update(groups)
        .set({
          descriptionEn: entry.descriptionEn,
          descriptionRu: entry.descriptionRu,
          parentGroupId: entry.parentGroupId,
          isDefault: entry.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(groups.id, existing[0].id))
        .returning();

      if (row === undefined) {
        throw new Error(`Failed to update group ${entry.name}`);
      }

      return toGroup(row);
    }

    const [row] = await this.db
      .insert(groups)
      .values({
        name: entry.name,
        descriptionEn: entry.descriptionEn,
        descriptionRu: entry.descriptionRu,
        parentGroupId: entry.parentGroupId,
        isDefault: entry.isDefault,
      })
      .returning();

    if (row === undefined) {
      throw new Error(`Failed to create group ${entry.name}`);
    }

    return toGroup(row);
  }

  async listUsers(): Promise<
    {
      readonly id: string;
      readonly email: string;
      readonly displayName: string;
      readonly avatarUrl: string | null;
      readonly createdAt: Date;
    }[]
  > {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
    }));
  }

  async findUserSummary(userId: string): Promise<{
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly createdAt: Date;
  } | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
    };
  }
}

function toPermission(row: typeof permissions.$inferSelect): RbacPermission {
  return {
    id: row.id,
    name: row.name,
    descriptionEn: row.descriptionEn,
    descriptionRu: row.descriptionRu,
    module: row.module,
  };
}

function toGroup(row: typeof groups.$inferSelect): RbacGroup {
  return {
    id: row.id,
    name: row.name,
    descriptionEn: row.descriptionEn,
    descriptionRu: row.descriptionRu,
    parentGroupId: row.parentGroupId,
    isDefault: row.isDefault,
  };
}
