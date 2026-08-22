import type { Brand } from '@/shared/types/Brand';

export type SpaceId = Brand<string, 'SpaceId'>;

export const spacePermissions = [
  'space.view',
  'space.invite',
  'space.manageMembers',
  'surfaceObject.create',
  'surfaceObject.update',
  'surfaceObject.delete',
  'surfaceObject.changeState',
  'surface.view',
  'timeline.export',
] as const;

export type SpacePermission = (typeof spacePermissions)[number];

export type SpaceRole = 'Owner' | 'Member';

export type SpaceType = 'Personal' | 'Shared';

const OWNER_PERMISSIONS: readonly SpacePermission[] = spacePermissions;

/**
 * A Member may act on the surface but not change who is in the space.
 * Invitation-time overrides are stored per member, so this is only the default.
 */
const MEMBER_PERMISSIONS: readonly SpacePermission[] = [
  'space.view',
  'surface.view',
  'surfaceObject.create',
  'surfaceObject.update',
  'surfaceObject.delete',
  'surfaceObject.changeState',
];

export function defaultPermissionsForRole(role: SpaceRole): readonly SpacePermission[] {
  return role === 'Owner' ? OWNER_PERMISSIONS : MEMBER_PERMISSIONS;
}

export function isSpacePermission(value: string): value is SpacePermission {
  return (spacePermissions as readonly string[]).includes(value);
}
