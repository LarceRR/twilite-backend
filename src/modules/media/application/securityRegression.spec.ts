import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@/shared/errors/AppError';
import { DomainError } from '@/shared/errors';

import { mediaQuotaExceededError } from '@/modules/media/application/assertMediaUploadPolicy';
import { assertNotSelfModeration } from '@/modules/tpg-pixel-objects/application/assertNotSelfModeration';
import { buildOpaqueStorageKey } from '@/modules/media/domain/opaqueStorageKey';
import { assertHttpImageUrl } from '@/modules/tpg/domain/services/assertHttpImageUrl';

/**
 * P5-S2 security regression matrix (SEC-01..SEC-05 unit surface).
 * Full HTTP e2e lives under test/integration when RUN_INTEGRATION=1.
 */
describe('P5-S2 security regression', () => {
  it('SEC quota: MEDIA_QUOTA_EXCEEDED is 429', () => {
    const error = mediaQuotaExceededError(50);
    expect(error.code).toBe(ErrorCode.MEDIA_QUOTA_EXCEEDED);
    expect(error.httpStatus).toBe(429);
  });

  it('SEC self-moderation: author cannot review own object', () => {
    expect(() =>
      assertNotSelfModeration({ authorUserId: 'a', reviewerUserId: 'a' }),
    ).toThrow(DomainError);
  });

  it('SEC opaque keys: storage key does not embed user id path segment', () => {
    const key = buildOpaqueStorageKey('image');
    expect(key).toMatch(/^media\/image\/[0-9a-f-]{36}$/i);
  });

  it('SEC SSRF: private targets blocked', () => {
    expect(() => assertHttpImageUrl('http://127.0.0.1/x.png')).toThrow();
    expect(() => assertHttpImageUrl('http://10.0.0.1/x.png')).toThrow();
    expect(() => assertHttpImageUrl('http://[fe80::1]/x.png')).toThrow();
  });

  it('SEC log redaction: public error JSON has no storage urls', () => {
    const error = new DomainError(
      'mismatch',
      { assetId: 'x' },
      { code: ErrorCode.MEDIA_SIZE_MISMATCH },
    );
    const body = JSON.stringify(error.toPublicJson());
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).not.toContain('presign');
  });
});
