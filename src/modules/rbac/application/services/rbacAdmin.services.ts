import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ValidationError } from '@/shared/errors';

import {
  RBAC_REPOSITORY,
  type RbacRepository,
  type UserPermissionOverrideType,
} from '../../domain/repositories/RbacRepository';
import { wouldCreateInheritanceCycle } from '../../domain/services/groupInheritance';
import { RbacSeedService } from '../../seed/rbacSeed.service';
import { EffectivePermissionsService } from './effectivePermissions.service';
import { RbacCacheService } from './rbacCache.service';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository,
    private readonly cache: RbacCacheService,
  ) {}

  async list() {
    const groups = await this.rbac.listGroups();
    return Promise.all(
      groups.map(async (group) => ({
        ...group,
        permissionIds: await this.rbac.listGroupPermissionIds(group.id),
        permissionNames: await this.rbac.listGroupPermissionNames(group.id),
      })),
    );
  }

  async getById(id: string) {
    const group = await this.rbac.findGroupById(id);

    if (group === null) {
      return null;
    }

    return {
      ...group,
      permissionIds: await this.rbac.listGroupPermissionIds(id),
      permissionNames: await this.rbac.listGroupPermissionNames(id),
    };
  }

  async update(
    id: string,
    input: {
      readonly name?: string;
      readonly descriptionEn?: string;
      readonly descriptionRu?: string;
      readonly parentGroupId?: string | null;
      readonly permissionIds?: readonly string[];
    },
  ) {
    const existing = await this.rbac.findGroupById(id);

    if (existing === null) {
      return null;
    }

    if (input.parentGroupId !== undefined) {
      const parentOf = await this.rbac.loadGroupParentMap();

      if (wouldCreateInheritanceCycle(id, input.parentGroupId, parentOf)) {
        throw new ValidationError('Cannot set parent: would create a circular inheritance');
      }

      if (input.parentGroupId !== null) {
        const parent = await this.rbac.findGroupById(input.parentGroupId);

        if (parent === null) {
          throw new ValidationError('Parent group not found');
        }
      }
    }

    if (input.permissionIds !== undefined) {
      for (const permissionId of input.permissionIds) {
        const permission = await this.rbac.findPermissionById(permissionId);

        if (permission === null) {
          throw new ValidationError(`Permission not found: ${permissionId}`);
        }
      }
    }

    const updated = await this.rbac.updateGroup(id, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.descriptionEn === undefined ? {} : { descriptionEn: input.descriptionEn }),
      ...(input.descriptionRu === undefined ? {} : { descriptionRu: input.descriptionRu }),
      ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
    });

    if (input.permissionIds !== undefined) {
      await this.rbac.replaceGroupPermissions(id, input.permissionIds);
    }

    await this.cache.invalidateByGroup(id);

    return this.getById(updated.id);
  }
}

@Injectable()
export class PermissionsAdminService {
  constructor(@Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository) {}

  list() {
    return this.rbac.listPermissions();
  }
}

@Injectable()
export class UserRbacService {
  constructor(
    @Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository,
    private readonly effective: EffectivePermissionsService,
    private readonly cache: RbacCacheService,
  ) {}

  async listUsers() {
    return this.rbac.listUsers();
  }

  async getUser(userId: string) {
    const user = await this.rbac.findUserSummary(userId);

    if (user === null) {
      return null;
    }

    const groups = await this.rbac.listUserGroups(userId);
    const overrides = await this.rbac.listUserOverrides(userId);
    const permissions = await this.effective.getEffectivePermissions(userId);

    return { ...user, groups, overrides, permissions };
  }

  async setUserOverrides(
    userId: string,
    overrides: readonly {
      readonly permissionId: string;
      readonly type: UserPermissionOverrideType;
    }[],
  ) {
    const user = await this.rbac.findUserSummary(userId);

    if (user === null) {
      return null;
    }

    for (const override of overrides) {
      const permission = await this.rbac.findPermissionById(override.permissionId);

      if (permission === null) {
        throw new ValidationError(`Permission not found: ${override.permissionId}`);
      }
    }

    await this.rbac.setUserOverrides(userId, overrides);
    await this.cache.invalidate(userId);
    return this.getUser(userId);
  }

  async assignDefaultGroup(userId: string): Promise<void> {
    const defaultGroup = await this.rbac.findDefaultGroup();

    if (defaultGroup === null) {
      return;
    }

    await this.rbac.assignUserToGroup(userId, defaultGroup.id);
    await this.cache.invalidate(userId);
  }

  /** Existing accounts created before RBAC have no groups — attach the default once. */
  async ensureDefaultGroup(userId: string): Promise<void> {
    const groupIds = await this.rbac.listUserGroupIds(userId);

    if (groupIds.length > 0) {
      return;
    }

    await this.assignDefaultGroup(userId);
  }

  async getProfileExtras(userId: string): Promise<{
    groups: { id: string; name: string }[];
    permissions: string[];
  }> {
    const groups = await this.rbac.listUserGroups(userId);
    const permissions = await this.effective.getEffectivePermissions(userId);

    return {
      groups: groups.map((group) => ({ id: group.id, name: group.name })),
      permissions,
    };
  }
}

@Injectable()
export class RbacBootstrapService implements OnModuleInit {
  constructor(private readonly seed: RbacSeedService) {}

  async onModuleInit(): Promise<void> {
    await this.seed.seed();
  }
}
