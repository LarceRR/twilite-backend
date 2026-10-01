import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RbacRepository } from '../../domain/repositories/RbacRepository';
import { RbacCacheService } from './rbacCache.service';
import type { Cache } from '@/infrastructure/redis/redisCache';
import type { AppConfig } from '@/config/env';

describe('RbacCacheService.invalidateByGroup', () => {
  const cache = {
    invalidate: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as Cache;

  const rbac = {
    loadGroupChildrenMap: vi.fn(),
    listUserIdsInGroups: vi.fn(),
    listUserIdsWithPermissionAssignment: vi.fn(),
  } as unknown as RbacRepository;

  const config = { rbac: { cacheTtlSeconds: 300 } } as AppConfig;

  let service: RbacCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RbacCacheService(cache, rbac, config);
  });

  it('invalidates users in group and descendants', async () => {
    vi.mocked(rbac.loadGroupChildrenMap).mockResolvedValue(
      new Map([
        ['user', ['artist']],
        ['artist', ['admin']],
      ]),
    );
    vi.mocked(rbac.listUserIdsInGroups).mockResolvedValue(['u1', 'u2']);
    vi.mocked(cache.invalidate).mockResolvedValue(undefined);

    await service.invalidateByGroup('user');

    expect(rbac.listUserIdsInGroups).toHaveBeenCalledWith(
      expect.arrayContaining(['user', 'artist', 'admin']),
    );
    expect(cache.invalidate).toHaveBeenCalledWith(
      'rbac:user:u1:effective_permissions',
      'rbac:user:u2:effective_permissions',
    );
  });

  it('invalidateByPermission clears assigned users', async () => {
    vi.mocked(rbac.listUserIdsWithPermissionAssignment).mockResolvedValue(['u9']);
    vi.mocked(cache.invalidate).mockResolvedValue(undefined);

    await service.invalidateByPermission('perm-1');

    expect(cache.invalidate).toHaveBeenCalledWith('rbac:user:u9:effective_permissions');
  });
});
