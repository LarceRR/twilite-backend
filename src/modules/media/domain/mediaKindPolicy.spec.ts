import { describe, expect, it } from 'vitest';

import type { AppLimits } from '@/config/limits';

import { MEDIA_KIND_POLICIES, policyForKind } from './mediaKindPolicy';

const limits = {
  media: {
    imageMaxBytes: 10_485_760,
    audioMaxBytes: 26_214_400,
    avatarMaxBytes: 2_097_152,
  },
} as AppLimits;

describe('mediaKindPolicy', () => {
  it('resolves known kinds', () => {
    expect(policyForKind('pixel-sheet')?.contentTypes).toEqual(['image/png']);
    expect(policyForKind('unknown')).toBeNull();
  });

  it('caps pixel-sheet at 8 MiB', () => {
    expect(MEDIA_KIND_POLICIES['pixel-sheet'].maxBytes(limits)).toBe(8 * 1024 * 1024);
  });

  it('uses avatar max for avatar kind', () => {
    expect(MEDIA_KIND_POLICIES.avatar.maxBytes(limits)).toBe(2_097_152);
  });
});
