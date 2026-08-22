import { AppError, ErrorCode, type AppErrorKind, type ErrorContext } from './AppError';

export type FieldViolation = { readonly path: string; readonly message: string };

export class ValidationError extends AppError {
  readonly kind: AppErrorKind = 'validation';
  readonly code = ErrorCode.VALIDATION_FAILED;
  readonly httpStatus = 400;
  readonly violations: readonly FieldViolation[];

  constructor(message: string, violations: readonly FieldViolation[] = [], context?: ErrorContext) {
    super(message, context);
    this.violations = violations;
  }

  override toPublicJson(): {
    kind: AppErrorKind;
    code: ErrorCode;
    message: string;
    details?: ErrorContext;
  } {
    return {
      kind: this.kind,
      code: this.code,
      message: this.message,
      details: { violations: this.violations },
    };
  }
}

/** A domain invariant was violated (e.g. an illegal state transition). */
export class DomainError extends AppError {
  readonly kind: AppErrorKind = 'domain';
  readonly code = ErrorCode.DOMAIN_RULE_VIOLATION;
  readonly httpStatus = 422;
}

/** Something outside the process failed: database, cache, queue, storage. */
export class InfrastructureError extends AppError {
  readonly kind: AppErrorKind = 'infrastructure';
  readonly code = ErrorCode.INFRASTRUCTURE_UNAVAILABLE;
  readonly httpStatus = 503;
}

export class AuthenticationError extends AppError {
  readonly kind: AppErrorKind = 'authentication';
  readonly code = ErrorCode.UNAUTHORIZED;
  readonly httpStatus = 401;
}

export class AuthorizationError extends AppError {
  readonly kind: AppErrorKind = 'authorization';
  readonly code = ErrorCode.FORBIDDEN;
  readonly httpStatus = 403;
}

export class NotFoundError extends AppError {
  readonly kind: AppErrorKind = 'notFound';
  readonly code = ErrorCode.NOT_FOUND;
  readonly httpStatus = 404;
}

/** Optimistic locking mismatch. The client must refetch and retry. */
export class ConflictError extends AppError {
  readonly kind: AppErrorKind = 'conflict';
  readonly code = ErrorCode.CONFLICT;
  readonly httpStatus = 409;
}

export class UnknownError extends AppError {
  readonly kind: AppErrorKind = 'unknown';
  readonly code = ErrorCode.INTERNAL_ERROR;
  readonly httpStatus = 500;

  override toPublicJson(): { kind: AppErrorKind; code: ErrorCode; message: string } {
    return { kind: this.kind, code: this.code, message: 'Внутренняя ошибка сервера' };
  }
}

export function toAppError(value: unknown): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) return new UnknownError(value.message, {}, value);
  return new UnknownError('Неизвестная ошибка', { value: String(value) }, value);
}
