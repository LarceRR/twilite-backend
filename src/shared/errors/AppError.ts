/**
 * Stable machine-readable codes are part of the public API contract. Clients
 * branch on `code`, never on localized error messages.
 */
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DOMAIN_RULE_VIOLATION: 'DOMAIN_RULE_VIOLATION',
  INFRASTRUCTURE_UNAVAILABLE: 'INFRASTRUCTURE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppErrorKind =
  | 'validation'
  | 'domain'
  | 'infrastructure'
  | 'authentication'
  | 'authorization'
  | 'notFound'
  | 'conflict'
  | 'unknown';

export type ErrorContext = Readonly<Record<string, unknown>>;

export abstract class AppError extends Error {
  abstract readonly kind: AppErrorKind;
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;

  readonly context: ErrorContext;
  readonly origin: unknown;

  constructor(message: string, context: ErrorContext = {}, origin?: unknown) {
    super(message);
    this.name = new.target.name;
    this.context = context;
    this.origin = origin;
    Error.captureStackTrace?.(this, new.target);
  }

  /** Only what is safe to send to a client. */
  toPublicJson(): { kind: AppErrorKind; code: ErrorCode; message: string; details?: ErrorContext } {
    return { kind: this.kind, code: this.code, message: this.message };
  }
}
