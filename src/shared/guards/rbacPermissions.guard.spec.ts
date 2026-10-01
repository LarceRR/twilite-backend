import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EffectivePermissionsService } from '@/modules/rbac/application/services/effectivePermissions.service';
import { AuthorizationError } from '@/shared/errors';

import { RbacPermissionsGuard } from '@/shared/guards/rbacPermissions.guard';

function mockContext(userId?: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId === undefined ? undefined : { userId, sessionId: 's1' },
      }),
    }),
  } as never;
}

describe('RbacPermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector;

  const effective = {
    hasAllPermissions: vi.fn(),
    hasAnyPermission: vi.fn(),
  } as unknown as EffectivePermissionsService;

  let guard: RbacPermissionsGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RbacPermissionsGuard(reflector, effective);
  });

  it('allows public routes', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === 'auth:isPublic') return true;
      return undefined;
    });

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('allows when no RBAC metadata', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);

    await expect(guard.canActivate(mockContext('u1'))).resolves.toBe(true);
  });

  it('allows when user has all required permissions', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === 'rbac:requireAll') return ['twilite.users.view'];
      return undefined;
    });
    vi.mocked(effective.hasAllPermissions).mockResolvedValue(true);

    await expect(guard.canActivate(mockContext('u1'))).resolves.toBe(true);
  });

  it('denies when user lacks permissions', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === 'rbac:requireAll') return ['ta.adminPanel.access'];
      return undefined;
    });
    vi.mocked(effective.hasAllPermissions).mockResolvedValue(false);

    await expect(guard.canActivate(mockContext('u1'))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('supports require-any metadata', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === 'rbac:requireAny') return ['a', 'b'];
      return undefined;
    });
    vi.mocked(effective.hasAnyPermission).mockResolvedValue(true);

    await expect(guard.canActivate(mockContext('u1'))).resolves.toBe(true);
  });
});
