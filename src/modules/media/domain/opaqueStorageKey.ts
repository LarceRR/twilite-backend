import { randomUUID } from 'node:crypto';

/**
 * Opaque object keys must not embed user IDs (ADR-016 / P1-S6).
 * Legacy keys `${userId}/…` remain readable; new writes use this format.
 */
export function buildOpaqueStorageKey(kind: string): string {
  return `media/${kind}/${randomUUID()}`;
}
