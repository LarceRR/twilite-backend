import { describe, expect, it } from 'vitest';

import {
  defaultPermissionsForRole,
  isSpacePermission,
  spacePermissions,
} from '@/modules/spaces/domain/value-objects/SpacePermission';

describe('права в пространстве', () => {
  it('владелец получает полный набор прав', () => {
    expect(defaultPermissionsForRole('Owner')).toEqual(spacePermissions);
  });

  it('участник может работать с поверхностью, но не с составом участников', () => {
    const member = defaultPermissionsForRole('Member');

    expect(member).toContain('surfaceObject.create');
    expect(member).toContain('surface.view');
    expect(member).not.toContain('space.manageMembers');
    expect(member).not.toContain('space.invite');
  });

  it('отклоняет неизвестные строки прав', () => {
    expect(isSpacePermission('space.view')).toBe(true);
    expect(isSpacePermission('space.deleteEverything')).toBe(false);
  });
});
