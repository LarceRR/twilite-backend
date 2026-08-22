import { DomainError } from '../errors';

/** Compile-time exhaustiveness guard for discriminated unions. */
export function assertNever(value: never, message = 'Необработанный вариант'): never {
  throw new DomainError(message, { value: String(value) });
}
