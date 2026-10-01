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
  /** Default platform RBAC effective-permissions TTL; overridden by RBAC_CACHE_TTL. */
  rbacEffectivePermissions: 300,
  /**
   * After refresh rotation, the previous refresh token remains redeemable for this
   * window so concurrent tabs / Strict Mode retries do not trigger theft revocation.
   */
  refreshReuseGrace: 30,
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
  rbacEffectivePermissions: (userId: string) => `rbac:user:${userId}:effective_permissions`,
  refreshReuseGrace: (sessionId: string) => `auth:refresh-grace:${sessionId}`,
} as const;
