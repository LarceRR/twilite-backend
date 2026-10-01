import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RbacRepository } from '../../domain/repositories/RbacRepository';
import { EffectivePermissionsService } from '../services/effectivePermissions.service';
import type { RbacCacheService } from '../services/rbacCache.service';

describe('EffectivePermissionsService', () => {
  const rbac = {
    listUserGroupIds: vi.fn(),
    loadGroupParentMap: vi.fn(),
    listGroupPermissionNames: vi.fn(),
    listUserOverrides: vi.fn(),
  } as unknown as RbacRepository;

  const cache = {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as RbacCacheService;

  let service: EffectivePermissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EffectivePermissionsService(rbac, cache);
    vi.mocked(cache.get).mockResolvedValue(null);
    vi.mocked(cache.set).mockResolvedValue(undefined);
  });

  it('unions permissions from group and ancestors', async () => {
    vi.mocked(rbac.listUserGroupIds).mockResolvedValue(['admin']);
    vi.mocked(rbac.loadGroupParentMap).mockResolvedValue(
      new Map([
        ['user', null],
        ['artist', 'user'],
        ['admin', 'artist'],
      ]),
    );
    vi.mocked(rbac.listGroupPermissionNames).mockImplementation(async (groupId: string) => {
      if (groupId === 'user') return ['twilite.auth.*', 'tpg.editor.view'];
      if (groupId === 'artist') return ['tpg.editor.edit'];
      if (groupId === 'admin') return ['ta.adminPanel.access'];
      return [];
    });
    vi.mocked(rbac.listUserOverrides).mockResolvedValue([]);

    const result = await service.getEffectivePermissions('u1');

    expect(result).toEqual(
      ['ta.adminPanel.access', 'tpg.editor.edit', 'tpg.editor.view', 'twilite.auth.*'].sort(),
    );
    expect(cache.set).toHaveBeenCalled();
  });

  it('applies GRANT and DENY overrides', async () => {
    vi.mocked(rbac.listUserGroupIds).mockResolvedValue(['user']);
    vi.mocked(rbac.loadGroupParentMap).mockResolvedValue(new Map([['user', null]]));
    vi.mocked(rbac.listGroupPermissionNames).mockResolvedValue([
      'twilite.users.view',
      'tpg.editor.view',
    ]);
    vi.mocked(rbac.listUserOverrides).mockResolvedValue([
      { permissionId: 'p1', permissionName: 'ta.adminPanel.access', type: 'GRANT' },
      { permissionId: 'p2', permissionName: 'tpg.editor.view', type: 'DENY' },
    ]);

    const result = await service.getEffectivePermissions('u1');

    expect(result).toContain('twilite.users.view');
    expect(result).toContain('ta.adminPanel.access');
    expect(result).not.toContain('tpg.editor.view');
  });

  it('returns cached value without recomputing', async () => {
    vi.mocked(cache.get).mockResolvedValue(['cached.perm']);

    const result = await service.getEffectivePermissions('u1');

    expect(result).toEqual(['cached.perm']);
    expect(rbac.listUserGroupIds).not.toHaveBeenCalled();
  });

  it('hasPermission uses wildcard matching', async () => {
    vi.mocked(cache.get).mockResolvedValue(['twilite.auth.*']);

    await expect(service.hasPermission('u1', 'twilite.auth.logout')).resolves.toBe(true);
    await expect(service.hasAllPermissions('u1', ['twilite.auth.login'])).resolves.toBe(true);
    await expect(service.hasAnyPermission('u1', ['ta.adminPanel.access'])).resolves.toBe(false);
  });
});
