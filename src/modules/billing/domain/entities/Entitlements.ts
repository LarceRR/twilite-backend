/**
 * Capabilities the product sells. Nothing anywhere checks a plan name or an
 * `isPremium` flag — features ask for the capability they need, so pricing can
 * change without touching business logic.
 */
export const entitlementKeys = [
  'canUseAI',
  'canCreateMultipleSpaces',
  'canExportTimeline',
  'canUploadVoice',
] as const;

export type EntitlementKey = (typeof entitlementKeys)[number];

export type Entitlements = Readonly<Record<EntitlementKey, boolean>>;

/** What every account gets without paying. */
export const freeEntitlements: Entitlements = {
  canUseAI: false,
  canCreateMultipleSpaces: true,
  canExportTimeline: false,
  canUploadVoice: false,
};

export function isEntitlementKey(value: string): value is EntitlementKey {
  return (entitlementKeys as readonly string[]).includes(value);
}
