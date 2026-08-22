import { ValidationError } from '@/shared/errors';
import type { Brand } from '@/shared/types/Brand';

export type Email = Brand<string, 'Email'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Stored lowercased so lookups are exact and case cannot fork an account. */
export function toEmail(value: string): Email {
  const normalized = value.trim().toLowerCase();

  if (!isEmail(normalized)) {
    throw new ValidationError('Некорректный адрес почты', [
      { path: 'email', message: 'Ожидается адрес вида name@example.com' },
    ]);
  }

  return normalized as Email;
}
