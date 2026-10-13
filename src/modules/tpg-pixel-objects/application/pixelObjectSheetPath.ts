/**
 * Same-origin API path for a spritesheet. The global prefix is `v1`.
 * Revision is part of the path because a published head and a pending resubmit
 * are different PNGs for the same object id.
 */
export function pixelObjectSheetPath(objectId: string, revision: number): string {
  return `/v1/tpg/pixel-objects/${objectId}/revisions/${revision}/sheet`;
}

export function pixelObjectPreviewPath(objectId: string, revision: number): string {
  return `/v1/tpg/pixel-objects/${objectId}/revisions/${revision}/preview`;
}
