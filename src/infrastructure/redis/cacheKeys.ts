/**
 * Cache keys and TTLs in one place: an invalidation rule that lives next to the
 * key it clears cannot drift out of sync.
 */
export const cacheTtl = {
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
  profile: (userId: string) => `profile:${userId}`,
  entitlements: (userId: string) => `entitlements:${userId}`,
  rbacEffectivePermissions: (userId: string) => `rbac:user:${userId}:effective_permissions`,
  refreshReuseGrace: (sessionId: string) => `auth:refresh-grace:${sessionId}`,
} as const;
