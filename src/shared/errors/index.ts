export { AppError, ErrorCode, type AppErrorKind, type ErrorContext } from './AppError';
export {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  type FieldViolation,
  InfrastructureError,
  NotFoundError,
  toAppError,
  UnknownError,
  ValidationError,
} from './errors';
