/**
 * Cache keys and TTLs in one place: an invalidation rule that lives next to the
 * key it clears cannot drift out of sync.
 */
export const cacheTtl = {
  space: 60,
  spaceList: 30,
  surfaceSnapshot: 30,
  timelinePage: 30,
  profile: 300,
  permissions: 120,
  entitlements: 120,
  statistics: 60,
} as const;

export const cacheKeys = {
  space: (spaceId: string) => `space:${spaceId}`,
  spaceList: (userId: string) => `space:list:${userId}`,
  spacePrefix: (spaceId: string) => `space:${spaceId}`,
  surfaceSnapshot: (spaceId: string) => `surface:snapshot:${spaceId}`,
  timelinePrefix: (spaceId: string) => `timeline:${spaceId}`,
  timelinePage: (spaceId: string, cursor: string, limit: number, types: string) =>
    `timeline:${spaceId}:${cursor}:${limit}:${types}`,
  statistics: (spaceId: string) => `statistics:${spaceId}`,
  profile: (userId: string) => `profile:${userId}`,
  permissions: (spaceId: string, userId: string) => `permissions:${spaceId}:${userId}`,
  entitlements: (userId: string) => `entitlements:${userId}`,
} as const;
