import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '@/shared/errors';

import type { RbacRepository } from '../../domain/repositories/RbacRepository';
import { GroupsService } from './rbacAdmin.services';
import type { RbacCacheService } from './rbacCache.service';

describe('GroupsService.update cycle detection', () => {
  const rbac = {
    findGroupById: vi.fn(),
    loadGroupParentMap: vi.fn(),
    updateGroup: vi.fn(),
    replaceGroupPermissions: vi.fn(),
    listGroupPermissionIds: vi.fn(),
    listGroupPermissionNames: vi.fn(),
  } as unknown as RbacRepository;

  const cache = {
    invalidateByGroup: vi.fn(),
  } as unknown as RbacCacheService;

  let service: GroupsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GroupsService(rbac, cache);
    vi.mocked(rbac.findGroupById).mockResolvedValue({
      id: 'user',
      name: 'User',
      descriptionEn: '',
      descriptionRu: '',
      parentGroupId: null,
      isDefault: true,
    });
    vi.mocked(rbac.loadGroupParentMap).mockResolvedValue(
      new Map([
        ['user', null],
        ['artist', 'user'],
        ['admin', 'artist'],
      ]),
    );
  });

  it('rejects parent that creates a cycle', async () => {
    await expect(service.update('user', { parentGroupId: 'admin' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.update('user', { parentGroupId: 'admin' })).rejects.toThrow(
      'Cannot set parent: would create a circular inheritance',
    );
  });
});
