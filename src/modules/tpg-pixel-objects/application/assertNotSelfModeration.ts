/**
 * Self-moderation is allowed when the actor has `tpg.pixelObjects.moderate`
 * (enforced at the controller RBAC gate). Kept as a no-op for call-site clarity
 * and historical SEC regression imports.
 */
export function assertNotSelfModeration(_input: {
  readonly authorUserId: string;
  readonly reviewerUserId: string;
  readonly allowSelf?: boolean;
}): void {
  // Moderators may publish/reject their own objects.
}
