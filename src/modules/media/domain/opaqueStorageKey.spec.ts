import { describe, expect, it } from 'vitest';

import { buildOpaqueStorageKey } from './opaqueStorageKey';

describe('buildOpaqueStorageKey', () => {
  it('does not embed a user id', () => {
    const key = buildOpaqueStorageKey('image');
    expect(key).toMatch(/^media\/image\/[0-9a-f-]{36}$/i);
    expect(key).not.toContain('user');
  });

  it('is unique per call', () => {
    expect(buildOpaqueStorageKey('voice')).not.toBe(buildOpaqueStorageKey('voice'));
  });
});
