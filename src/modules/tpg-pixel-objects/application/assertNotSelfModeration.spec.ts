import { describe, expect, it } from 'vitest';

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

  it('allows self moderation when the actor has moderate permission (RBAC gate)', () => {
    expect(() =>
      assertNotSelfModeration({
        authorUserId: 'a',
        reviewerUserId: 'a',
      }),
    ).not.toThrow();
  });
});
