import { describe, expect, it } from 'vitest';

import { DomainError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import { assertNotSelfModeration } from './assertNotSelfModeration';

describe('assertNotSelfModeration', () => {
  it('allows different reviewer', () => {
    expect(() =>
      assertNotSelfModeration({
        authorUserId: 'a',
        reviewerUserId: 'b',
      }),
    ).not.toThrow();
  });

  it('blocks self moderation', () => {
    expect(() =>
      assertNotSelfModeration({
        authorUserId: 'a',
        reviewerUserId: 'a',
      }),
    ).toThrow(DomainError);

    try {
      assertNotSelfModeration({ authorUserId: 'a', reviewerUserId: 'a' });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(ErrorCode.PIXEL_OBJECT_SELF_MODERATION);
      expect((error as DomainError).httpStatus).toBe(403);
    }
  });

  it('allows explicit admin override', () => {
    expect(() =>
      assertNotSelfModeration({
        authorUserId: 'a',
        reviewerUserId: 'a',
        allowSelf: true,
      }),
    ).not.toThrow();
  });
});
