import { describe, expect, it } from 'vitest';

import type { AppLimits } from '@/config/limits';
import { DomainError, ValidationError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import { assertMediaUploadPolicy, mediaQuotaExceededError } from './assertMediaUploadPolicy';

const limits = {
  media: {
    imageMaxBytes: 1_000,
    audioMaxBytes: 2_000,
    avatarMaxBytes: 500,
  },
} as AppLimits;

describe('assertMediaUploadPolicy', () => {
  it('accepts valid pixel-sheet png', () => {
    expect(() =>
      assertMediaUploadPolicy({
        kind: 'pixel-sheet',
        contentType: 'image/png',
        byteSize: 100,
        limits,
      }),
    ).not.toThrow();
  });

  it('rejects wrong content type', () => {
    expect(() =>
      assertMediaUploadPolicy({
        kind: 'pixel-sheet',
        contentType: 'image/jpeg',
        byteSize: 100,
        limits,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects oversize', () => {
    expect(() =>
      assertMediaUploadPolicy({
        kind: 'image',
        contentType: 'image/png',
        byteSize: 2_000,
        limits,
      }),
    ).toThrow(ValidationError);
  });
});

describe('mediaQuotaExceededError', () => {
  it('maps to MEDIA_QUOTA_EXCEEDED 429', () => {
    const error = mediaQuotaExceededError(50);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(ErrorCode.MEDIA_QUOTA_EXCEEDED);
    expect(error.httpStatus).toBe(429);
  });
});
