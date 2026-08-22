import { describe, expect, it } from 'vitest';

import { ErrorCode } from './AppError';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  InfrastructureError,
  NotFoundError,
  UnknownError,
  ValidationError,
} from './errors';

describe('stable API error contract', () => {
  it.each([
    [new AuthenticationError('no session'), ErrorCode.UNAUTHORIZED, 401],
    [new AuthorizationError('denied'), ErrorCode.FORBIDDEN, 403],
    [new NotFoundError('missing'), ErrorCode.NOT_FOUND, 404],
    [new ConflictError('duplicate'), ErrorCode.CONFLICT, 409],
    [new ValidationError('invalid'), ErrorCode.VALIDATION_FAILED, 400],
    [new DomainError('illegal'), ErrorCode.DOMAIN_RULE_VIOLATION, 422],
    [new InfrastructureError('down'), ErrorCode.INFRASTRUCTURE_UNAVAILABLE, 503],
    [new UnknownError('secret detail'), ErrorCode.INTERNAL_ERROR, 500],
  ])('exposes %s as stable code %s', (error, code, status) => {
    expect(error.code).toBe(code);
    expect(error.httpStatus).toBe(status);
  });

  it('does not expose unexpected error details', () => {
    const body = new UnknownError('database password=not-for-users').toPublicJson();

    expect(body).toEqual({
      kind: 'unknown',
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Внутренняя ошибка сервера',
    });
  });

  it('keeps validation violations machine-readable', () => {
    expect(
      new ValidationError('invalid', [{ path: 'title', message: 'required' }]).toPublicJson(),
    ).toEqual({
      kind: 'validation',
      code: ErrorCode.VALIDATION_FAILED,
      message: 'invalid',
      details: { violations: [{ path: 'title', message: 'required' }] },
    });
  });
});
