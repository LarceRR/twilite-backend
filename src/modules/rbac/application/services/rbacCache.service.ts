import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import { cacheKeys } from '@/infrastructure/redis/cacheKeys';
import { CACHE, type Cache } from '@/infrastructure/redis/redisCache';

import { RBAC_REPOSITORY, type RbacRepository } from '../../domain/repositories/RbacRepository';
import { collectDescendantGroupIds } from '../../domain/services/groupInheritance';

@Injectable()
export class RbacCacheService {
  constructor(
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(RBAC_REPOSITORY) private readonly rbac: RbacRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  ttlSeconds(): number {
    return this.config.rbac.cacheTtlSeconds;
  }

  async get(userId: string): Promise<string[] | null> {
    return this.cache.get<string[]>(cacheKeys.rbacEffectivePermissions(userId));
  }

  async set(userId: string, permissions: string[]): Promise<void> {
    await this.cache.set(
      cacheKeys.rbacEffectivePermissions(userId),
      permissions,
      this.ttlSeconds(),
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.invalidate(cacheKeys.rbacEffectivePermissions(userId));
  }

  async invalidateMany(userIds: readonly string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    await this.cache.invalidate(
      ...userIds.map((userId) => cacheKeys.rbacEffectivePermissions(userId)),
    );
  }

  async invalidateByGroup(groupId: string): Promise<void> {
    const childrenOf = await this.rbac.loadGroupChildrenMap();
    const affectedGroups = collectDescendantGroupIds(groupId, childrenOf);
    const userIds = await this.rbac.listUserIdsInGroups(affectedGroups);
    await this.invalidateMany(userIds);
  }

  async invalidateByPermission(permissionId: string): Promise<void> {
    const userIds = await this.rbac.listUserIdsWithPermissionAssignment(permissionId);
    await this.invalidateMany(userIds);
  }
}
