import { describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '@/shared/errors';

import { assertThemePendingForReview } from './assertThemePendingForReview';

describe('assertThemePendingForReview', () => {
  it('allows pending themes including when author would equal reviewer', () => {
    expect(() => assertThemePendingForReview({ status: 'pending' })).not.toThrow();
  });

  it('rejects missing themes', () => {
    expect(() => assertThemePendingForReview(null)).toThrow(NotFoundError);
  });

  it('rejects already reviewed themes', () => {
    expect(() => assertThemePendingForReview({ status: 'published' })).toThrow(ConflictError);
    expect(() => assertThemePendingForReview({ status: 'rejected' })).toThrow(ConflictError);
  });
});
