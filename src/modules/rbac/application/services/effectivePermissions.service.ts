import { Inject, Injectable } from '@nestjs/common';

import { RBAC_REPOSITORY, type RbacRepository } from '../../domain/repositories/RbacRepository';
import { collectAncestorGroupIds } from '../../domain/services/groupInheritance';
import {
  hasAllPermissionMatches,
  hasAnyPermissionMatch,
  hasPermissionMatch,
} from '../../domain/services/permissionMatcher';
import { RbacCacheService } from './rbacCache.service';

@Injectable()
export class EffectivePermissionsService {
  constructor(
    @Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository,
    private readonly cache: RbacCacheService,
  ) {}

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const cached = await this.cache.get(userId);

    if (cached !== null) {
      return cached;
    }

    const computed = await this.computeEffectivePermissions(userId);
    await this.cache.set(userId, computed);
    return computed;
  }

  async hasPermission(userId: string, requiredPermission: string): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return hasPermissionMatch(effective, requiredPermission);
  }

  async hasAllPermissions(userId: string, required: readonly string[]): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return hasAllPermissionMatches(effective, required);
  }

  async hasAnyPermission(userId: string, required: readonly string[]): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return hasAnyPermissionMatch(effective, required);
  }

  private async computeEffectivePermissions(userId: string): Promise<string[]> {
    const userGroupIds = await this.rbac.listUserGroupIds(userId);
    const parentOf = await this.rbac.loadGroupParentMap();
    const ancestorIds = new Set<string>();

    for (const groupId of userGroupIds) {
      for (const ancestorId of collectAncestorGroupIds(groupId, parentOf)) {
        ancestorIds.add(ancestorId);
      }
    }

    const fromGroups = new Set<string>();

    for (const groupId of ancestorIds) {
      for (const name of await this.rbac.listGroupPermissionNames(groupId)) {
        fromGroups.add(name);
      }
    }

    const overrides = await this.rbac.listUserOverrides(userId);
    const granted = new Set<string>();
    const denied = new Set<string>();

    for (const override of overrides) {
      if (override.type === 'GRANT') {
        granted.add(override.permissionName);
      } else {
        denied.add(override.permissionName);
      }
    }

    const effective = new Set<string>([...fromGroups, ...granted]);

    for (const name of denied) {
      effective.delete(name);
    }

    return [...effective].sort();
  }
}
