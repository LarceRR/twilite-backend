/**
 * Detects whether setting `parentId` on `groupId` would create a cycle.
 * `parentOf` maps groupId → parentGroupId (or null/undefined if none).
 */
export function wouldCreateInheritanceCycle(
  groupId: string,
  parentId: string | null,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  if (parentId === null) {
    return false;
  }

  if (parentId === groupId) {
    return true;
  }

  const visited = new Set<string>();
  let current: string | null = parentId;

  while (current !== null) {
    if (current === groupId) {
      return true;
    }

    if (visited.has(current)) {
      // Existing cycle in data — treat as unsafe.
      return true;
    }

    visited.add(current);
    current = parentOf.get(current) ?? null;
  }

  return false;
}

/**
 * Walk ancestors of `startGroupId` including itself. Cycle-safe via visited set.
 */
export function collectAncestorGroupIds(
  startGroupId: string,
  parentOf: ReadonlyMap<string, string | null>,
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  let current: string | null = startGroupId;

  while (current !== null) {
    if (visited.has(current)) {
      break;
    }

    visited.add(current);
    result.push(current);
    current = parentOf.get(current) ?? null;
  }

  return result;
}

/**
 * Collect groupId and all descendants (groups that inherit from it transitively).
 */
export function collectDescendantGroupIds(
  rootGroupId: string,
  childrenOf: ReadonlyMap<string, readonly string[]>,
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [rootGroupId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);
    result.push(current);

    for (const child of childrenOf.get(current) ?? []) {
      stack.push(child);
    }
  }

  return result;
}
