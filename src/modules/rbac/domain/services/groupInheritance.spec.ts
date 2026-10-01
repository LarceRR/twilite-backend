import { describe, expect, it } from 'vitest';

import {
  collectAncestorGroupIds,
  collectDescendantGroupIds,
  wouldCreateInheritanceCycle,
} from './groupInheritance';

describe('wouldCreateInheritanceCycle', () => {
  const parentOf = new Map<string, string | null>([
    ['user', null],
    ['artist', 'user'],
    ['admin', 'artist'],
  ]);

  it('allows setting parent to unrelated ancestor chain', () => {
    expect(wouldCreateInheritanceCycle('artist', 'user', parentOf)).toBe(false);
  });

  it('rejects self as parent', () => {
    expect(wouldCreateInheritanceCycle('user', 'user', parentOf)).toBe(true);
  });

  it('rejects parent that is a descendant', () => {
    expect(wouldCreateInheritanceCycle('user', 'admin', parentOf)).toBe(true);
    expect(wouldCreateInheritanceCycle('artist', 'admin', parentOf)).toBe(true);
  });

  it('allows clearing parent', () => {
    expect(wouldCreateInheritanceCycle('admin', null, parentOf)).toBe(false);
  });
});

describe('collectAncestorGroupIds', () => {
  it('walks up to root including self', () => {
    const parentOf = new Map<string, string | null>([
      ['user', null],
      ['artist', 'user'],
      ['admin', 'artist'],
    ]);

    expect(collectAncestorGroupIds('admin', parentOf)).toEqual(['admin', 'artist', 'user']);
  });

  it('stops on cycle without infinite loop', () => {
    const parentOf = new Map<string, string | null>([
      ['a', 'b'],
      ['b', 'a'],
    ]);

    expect(collectAncestorGroupIds('a', parentOf)).toEqual(['a', 'b']);
  });
});

describe('collectDescendantGroupIds', () => {
  it('includes self and all children', () => {
    const childrenOf = new Map<string, string[]>([
      ['user', ['artist']],
      ['artist', ['admin']],
      ['admin', []],
    ]);

    expect(collectDescendantGroupIds('user', childrenOf).sort()).toEqual(
      ['admin', 'artist', 'user'].sort(),
    );
  });
});
