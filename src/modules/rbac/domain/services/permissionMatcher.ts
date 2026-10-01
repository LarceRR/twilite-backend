/**
 * Wildcard permission matching.
 * - Exact match
 * - User permission segment `*` matches any remaining required segments
 * - Lone `*` matches everything
 */
export function matchesPermission(granted: string, required: string): boolean {
  if (granted === '*') {
    return true;
  }

  if (granted === required) {
    return true;
  }

  const grantedParts = granted.split('.');
  const requiredParts = required.split('.');

  for (let i = 0; i < grantedParts.length; i += 1) {
    const part = grantedParts[i];

    if (part === '*') {
      return true;
    }

    if (i >= requiredParts.length || part !== requiredParts[i]) {
      return false;
    }
  }

  return grantedParts.length === requiredParts.length;
}

export function hasPermissionMatch(
  effectivePermissions: readonly string[],
  required: string,
): boolean {
  return effectivePermissions.some((granted) => matchesPermission(granted, required));
}

export function hasAllPermissionMatches(
  effectivePermissions: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((permission) => hasPermissionMatch(effectivePermissions, permission));
}

export function hasAnyPermissionMatch(
  effectivePermissions: readonly string[],
  required: readonly string[],
): boolean {
  return required.some((permission) => hasPermissionMatch(effectivePermissions, permission));
}
