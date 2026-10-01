export type UserPermissionOverrideType = 'GRANT' | 'DENY';

export type RbacPermission = {
  readonly id: string;
  readonly name: string;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
  readonly module: string;
};

export type RbacGroup = {
  readonly id: string;
  readonly name: string;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
  readonly parentGroupId: string | null;
  readonly isDefault: boolean;
};

export type UserPermissionOverride = {
  readonly permissionId: string;
  readonly permissionName: string;
  readonly type: UserPermissionOverrideType;
};

export const RBAC_REPOSITORY = Symbol('RBAC_REPOSITORY');

export interface RbacRepository {
  listPermissions(): Promise<RbacPermission[]>;
  findPermissionById(id: string): Promise<RbacPermission | null>;
  findPermissionByName(name: string): Promise<RbacPermission | null>;

  listGroups(): Promise<RbacGroup[]>;
  findGroupById(id: string): Promise<RbacGroup | null>;
  findDefaultGroup(): Promise<RbacGroup | null>;
  updateGroup(
    id: string,
    input: {
      readonly name?: string;
      readonly descriptionEn?: string;
      readonly descriptionRu?: string;
      readonly parentGroupId?: string | null;
    },
  ): Promise<RbacGroup>;
  replaceGroupPermissions(groupId: string, permissionIds: readonly string[]): Promise<void>;
  listGroupPermissionIds(groupId: string): Promise<string[]>;
  listGroupPermissionNames(groupId: string): Promise<string[]>;

  listUserGroupIds(userId: string): Promise<string[]>;
  listUserGroups(userId: string): Promise<RbacGroup[]>;
  assignUserToGroup(userId: string, groupId: string): Promise<void>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;
  listUserIdsInGroups(groupIds: readonly string[]): Promise<string[]>;

  listUserOverrides(userId: string): Promise<UserPermissionOverride[]>;
  setUserOverrides(
    userId: string,
    overrides: readonly { readonly permissionId: string; readonly type: UserPermissionOverrideType }[],
  ): Promise<void>;

  listUserIdsWithPermissionAssignment(permissionId: string): Promise<string[]>;

  /** parentOf: groupId → parentGroupId */
  loadGroupParentMap(): Promise<Map<string, string | null>>;
  /** childrenOf: parentId → child ids */
  loadGroupChildrenMap(): Promise<Map<string, string[]>>;

  upsertPermission(entry: {
    readonly name: string;
    readonly descriptionEn: string;
    readonly descriptionRu: string;
    readonly module: string;
  }): Promise<RbacPermission>;

  upsertGroup(entry: {
    readonly name: string;
    readonly descriptionEn: string;
    readonly descriptionRu: string;
    readonly parentGroupId: string | null;
    readonly isDefault: boolean;
  }): Promise<RbacGroup>;

  listUsers(): Promise<
    {
      readonly id: string;
      readonly email: string;
      readonly displayName: string;
      readonly avatarUrl: string | null;
      readonly createdAt: Date;
    }[]
  >;

  findUserSummary(userId: string): Promise<{
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly createdAt: Date;
  } | null>;
}
