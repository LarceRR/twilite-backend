const BUCKET_HOST = /(\.r2\.dev|\.r2\.cloudflarestorage\.com)$/i;

/** Client uploads bytes here. The API writes them to object storage. */
export function mediaUploadPath(assetId: string): string {
  return `/v1/media/uploads/${assetId}`;
}

/** Owner-scoped read of a confirmed media row. */
export function mediaContentPath(assetId: string): string {
  return `/v1/media/${assetId}`;
}

export function userAvatarPath(userId: string): string {
  return `/v1/users/${userId}/avatar`;
}

export function projectAvatarPath(projectId: string): string {
  return `/v1/tpg/projects/${projectId}/avatar`;
}

/**
 * URL safe to put in a profile. A stored bucket link is never returned.
 * When the object key is known, the client loads `/v1/users/:id/avatar`.
 */
export function publicAvatarUrl(
  userId: string,
  storedUrl: string | null,
  storageKey: string | null,
): string | null {
  if (storageKey !== null && storageKey.length > 0) {
    return userAvatarPath(userId);
  }
  if (storedUrl === null || storedUrl.length === 0 || isBucketUrl(storedUrl)) {
    return null;
  }
  return storedUrl;
}

export function isBucketUrl(url: string): boolean {
  try {
    return BUCKET_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
